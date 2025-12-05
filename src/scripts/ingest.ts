import '@/lib/env-loader'; // Must be first
import { db } from '@/db';
import { tenants, customers, products, orders, orderItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchShopify, GET_CUSTOMERS_QUERY, GET_PRODUCTS_QUERY, GET_ORDERS_QUERY } from '@/lib/shopify';

if (!process.env.DATABASE_URL) {
  console.error(' DATABASE_URL is not defined. Please ensure you have a .env.local or .env file with a valid PostgreSQL connection string.');
  process.exit(1);
}
//console.log(process.env.DATABASE_URL);


async function ingest() {
  console.log(' Starting Ingestion Process...');

  // 1. Get ALL active Tenant (Store) configurations
  const allTenants = await db.query.tenants.findMany({
    where: (t, { eq }) => eq(t.isActive, true),
  });

  if (allTenants.length === 0) {
    console.error(' No active tenants found in database.');
    process.exit(1);
  }

  console.log(`Found ${allTenants.length} active tenants.`);

  for (const tenant of allTenants) {
    console.log(` Syncing data for store: ${tenant.storeDomain}`);

    try {
      // Determine Sync Mode (Full vs Incremental)
      let queryParams: any = { first: 50 };
      if (tenant.lastSyncedAt) {
          const lastSyncISO = tenant.lastSyncedAt.toISOString();
          queryParams.query = `updated_at:>'${lastSyncISO}'`;
          console.log(`    Incremental Sync: Fetching items updated after ${lastSyncISO}`);
      } else {
          console.log(`    Full Sync: Fetching all items`);
      }

      // --- CUSTOMERS ---
      console.log('   ...Fetching Customers');
      let hasNextPageCustomers = true;
      let cursorCustomers = null;

      while (hasNextPageCustomers) {
          const currentParams: any = { ...queryParams, cursor: cursorCustomers };
          const customersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_CUSTOMERS_QUERY, currentParams);
          
          if (customersData?.customers?.edges) {
              for (const edge of customersData.customers.edges) {
                  const node = edge.node;
                  await db.insert(customers).values({
                      tenantId: tenant.id,
                      shopifyId: node.id,
                      firstName: 'Redacted', // PII Restriction
                      lastName: 'Redacted',
                      email: 'redacted@example.com',
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
              console.log(`    Synced batch of ${customersData.customers.edges.length} customers`);
              
              hasNextPageCustomers = customersData.customers.pageInfo.hasNextPage;
              cursorCustomers = customersData.customers.pageInfo.endCursor;
          } else {
              hasNextPageCustomers = false;
          }
      }

      // --- PRODUCTS ---
      console.log('   ...Fetching Products');
      let hasNextPageProducts = true;
      let cursorProducts = null;

      while (hasNextPageProducts) {
          const currentParams: any = { ...queryParams, cursor: cursorProducts };
          const productsData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_PRODUCTS_QUERY, currentParams);

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
              console.log(`    Synced batch of ${productsData.products.edges.length} products`);

              hasNextPageProducts = productsData.products.pageInfo.hasNextPage;
              cursorProducts = productsData.products.pageInfo.endCursor;
          } else {
              hasNextPageProducts = false;
          }
      }

      // --- ORDERS ---
      console.log('   ...Fetching Orders');
      let hasNextPageOrders = true;
      let cursorOrders = null;

      while (hasNextPageOrders) {
          const currentParams: any = { ...queryParams, cursor: cursorOrders };
          const ordersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_ORDERS_QUERY, currentParams);

          if (ordersData?.orders?.edges) {
              for (const edge of ordersData.orders.edges) {
                  const node = edge.node;
                  
                  // Resolve Customer ID
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
                      // We need the local order ID. Since we just upserted, we can query it or use the shopifyId to find it.
                      // Ideally, we should get the ID from the insert, but .onConflictDoUpdate doesn't always return it easily in all drivers without `returning`.
                      // Let's fetch the order we just inserted/updated.
                      const [localOrder] = await db.select().from(orders).where(and(eq(orders.shopifyId, node.id), eq(orders.tenantId, tenant.id)));

                      if (localOrder) {
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
              console.log(`    Synced batch of ${ordersData.orders.edges.length} orders`);

              hasNextPageOrders = ordersData.orders.pageInfo.hasNextPage;
              cursorOrders = ordersData.orders.pageInfo.endCursor;
          } else {
              hasNextPageOrders = false;
          }
      }

      // Update lastSyncedAt
      await db.update(tenants)
          .set({ lastSyncedAt: new Date() })
          .where(eq(tenants.id, tenant.id));

    } catch (error) {
      console.error(` Ingestion Failed for ${tenant.storeDomain}:`, error);
      // Continue to next tenant instead of exiting process
    }
  } // End of tenant loop

  console.log(' Ingestion Complete!');
  process.exit(0);
}

ingest();
