import { db } from '@/db';
import { tenants, customers, products, orders, orderItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchShopify, GET_CUSTOMERS_QUERY, GET_PRODUCTS_QUERY, GET_ORDERS_QUERY } from '@/lib/shopify';

export async function ingestForTenant(tenantId: string) {
  const id = parseInt(tenantId);
  if (isNaN(id)) {
    throw new Error(`Invalid tenant ID: ${tenantId}. Must be a number.`);
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  console.log(`\n=== SYNC STARTED FOR TENANT: ${tenant.storeName} (${tenant.storeDomain}) ===`);
  console.log(`Tenant ID: ${tenant.id}`);
  console.log(`Last Synced At: ${tenant.lastSyncedAt}`);

  // Determine Sync Mode (Full vs Incremental)
  let queryParams: any = { first: 100 };
  if (tenant.lastSyncedAt) {
      const lastSyncISO = tenant.lastSyncedAt.toISOString();
      queryParams.query = `updated_at:>'${lastSyncISO}'`;
      console.log(` Incremental Sync: Fetching items updated after ${lastSyncISO}`);
  } else {
      console.log(` Full Sync: Fetching all items (limit 100)`);
  }

  // 1. Sync Customers
  const customersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_CUSTOMERS_QUERY, queryParams);
  if (customersData?.customers?.edges) {
      for (const edge of customersData.customers.edges) {
      const node = edge.node;
      // console.log("Processing Customer Node:", JSON.stringify(node, null, 2)); // DEBUG LOG
      await db.insert(customers).values({
          tenantId: tenant.id,
          shopifyId: node.id,
          firstName: node.firstName || 'Redacted',
          lastName: node.lastName || 'Redacted',
          email: node.email || 'redacted@example.com',
          totalSpent: node.amountSpent?.amount || '0',
          ordersCount: node.numberOfOrders,
          createdAt: new Date(node.createdAt),
      }).onConflictDoUpdate({
          target: [customers.shopifyId, customers.tenantId],
          set: {
          totalSpent: node.amountSpent?.amount || '0',
          ordersCount: node.numberOfOrders,
          updatedAt: new Date(),
          }
      });
      }
  }

  // 2. Sync Products
  const productsData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_PRODUCTS_QUERY, queryParams);
  if (productsData?.products?.edges) {
      for (const edge of productsData.products.edges) {
          const node = edge.node;
          await db.insert(products).values({
              tenantId: tenant.id,
              shopifyId: node.id,
              title: node.title,
              bodyHtml: node.bodyHtml,
              vendor: node.vendor,
              productType: node.productType,
              status: node.status,
              createdAt: new Date(node.createdAt),
          }).onConflictDoUpdate({
              target: [products.shopifyId, products.tenantId],
              set: {
                  title: node.title,
                  status: node.status,
              }
          });
      }
  }

  // 3. Sync Orders
  console.log('--- Fetching Orders ---');
  const ordersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_ORDERS_QUERY, queryParams);
  if (ordersData?.orders?.edges) {
      console.log(`Fetched ${ordersData.orders.edges.length} orders from Shopify.`);
      for (const edge of ordersData.orders.edges) {
          const node = edge.node;
          console.log(`Processing Order: ${node.id} | Created: ${node.createdAt} | Financial: ${node.displayFinancialStatus}`);
          
          // Find customer internal ID if exists
          let customerId = null;
          if (node.customer?.id) {
              const customer = await db.query.customers.findFirst({
                  where: (c, { eq, and }) => and(eq(c.shopifyId, node.customer.id), eq(c.tenantId, tenant.id)),
              });
              customerId = customer?.id;
          }

          await db.insert(orders).values({
              tenantId: tenant.id,
              shopifyId: node.id,
              customerId: customerId,
              totalPrice: node.totalPriceSet?.shopMoney?.amount || '0',
              currency: node.totalPriceSet?.shopMoney?.currencyCode,
              financialStatus: node.displayFinancialStatus,
              fulfillmentStatus: node.displayFulfillmentStatus,
              createdAt: new Date(node.createdAt),
          }).onConflictDoUpdate({
              target: [orders.shopifyId, orders.tenantId],
              set: {
                  fulfillmentStatus: node.displayFulfillmentStatus,
              }
          });

          // Ingest Order Items
          if (node.lineItems?.edges) {
              const [localOrder] = await db.select().from(orders).where(and(eq(orders.shopifyId, node.id), eq(orders.tenantId, tenant.id)));

              if (localOrder) {
                  // Clear existing items to avoid duplicates
                  await db.delete(orderItems).where(eq(orderItems.orderId, localOrder.id));

                  for (const liEdge of node.lineItems.edges) {
                      const li = liEdge.node;
                      let productId = null;
                      if (li.product?.id) {
                          const [prod] = await db.select().from(products).where(and(eq(products.shopifyId, li.product.id), eq(products.tenantId, tenant.id)));
                          productId = prod?.id;
                      }

                      await db.insert(orderItems).values({
                          orderId: localOrder.id,
                          productId: productId,
                          title: li.title,
                          quantity: li.quantity,
                          price: li.originalTotalSet?.shopMoney?.amount || '0',
                      });
                  }
              }
          }
      }
  }

  // 4. Update lastSyncedAt
  await db.update(tenants)
      .set({ lastSyncedAt: new Date() })
      .where(eq(tenants.id, tenant.id));

  console.log(`Sync completed for ${tenant.storeName}`);
}