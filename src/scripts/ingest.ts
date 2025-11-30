import '@/lib/env-loader'; // Must be first
import { db } from '@/db';
import { tenants, customers, products, orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchShopify, GET_CUSTOMERS_QUERY, GET_PRODUCTS_QUERY, GET_ORDERS_QUERY } from '@/lib/shopify';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined. Please ensure you have a .env.local or .env file with a valid PostgreSQL connection string.');
  process.exit(1);
}
//console.log(process.env.DATABASE_URL);


async function ingest() {
  console.log('🚀 Starting Ingestion Process...');

  // 1. Get the Tenant (Store) configuration
  // In a real app, you might loop through all active tenants
  const tenant = await db.query.tenants.findFirst();

  if (!tenant) {
    console.error('❌ No tenant found in database. Please add a tenant manually first.');
    process.exit(1);
  }

  console.log(`📦 Syncing data for store: ${tenant.storeDomain}`);

  try {
    // --- CUSTOMERS ---
    console.log('   ...Fetching Customers');
    const customersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_CUSTOMERS_QUERY, { first: 50 });
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
      console.log(`   ✅ Synced ${customersData.customers.edges.length} customers`);
    }

    // --- PRODUCTS ---
    console.log('   ...Fetching Products');
    const productsData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_PRODUCTS_QUERY, { first: 50 });
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
      console.log(`   ✅ Synced ${productsData.products.edges.length} products`);
    }

    // --- ORDERS ---
    console.log('   ...Fetching Orders');
    const ordersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_ORDERS_QUERY, { first: 50 });
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
            financialStatus: node.displayFinancialStatus,
            fulfillmentStatus: node.displayFulfillmentStatus,
          }
        });
      }
      console.log(`   ✅ Synced ${ordersData.orders.edges.length} orders`);
    }

    console.log('🎉 Ingestion Complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Ingestion Failed:', error);
    process.exit(1);
  }
}

ingest();
