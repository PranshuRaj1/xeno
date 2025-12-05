import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, customers, products, orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchShopify, GET_CUSTOMERS_QUERY, GET_PRODUCTS_QUERY, GET_ORDERS_QUERY } from '@/lib/shopify';

export const maxDuration = 300; // 5 minutes max duration for Vercel Pro (adjust as needed)

export async function GET(request: Request) {
  // 1. Verify Authentication
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🚀 Starting Scheduled Ingestion Process...');

  try {
    // 2. Get ALL active Tenant (Store) configurations
    const allTenants = await db.query.tenants.findMany({
      where: (t, { eq }) => eq(t.isActive, true),
    });

    if (allTenants.length === 0) {
      console.log('No active tenants found.');
      return NextResponse.json({ message: 'No active tenants found' });
    }

    console.log(`Found ${allTenants.length} active tenants.`);
    const results = [];

    for (const tenant of allTenants) {
      console.log(` Syncing data for store: ${tenant.storeDomain}`);
      try {
        // Determine Sync Mode (Full vs Incremental)
        let queryParams: any = { first: 50 };
        if (tenant.lastSyncedAt) {
            const lastSyncISO = tenant.lastSyncedAt.toISOString();
            queryParams.query = `updated_at:>'${lastSyncISO}'`;
            console.log(`   🔄 Incremental Sync: Fetching items updated after ${lastSyncISO}`);
        } else {
            console.log(`   🌍 Full Sync: Fetching all items`);
        }

        // --- CUSTOMERS ---
        let hasNextPageCustomers = true;
        let cursorCustomers = null;
        let customersCount = 0;

        while (hasNextPageCustomers) {
            const currentParams: any = { ...queryParams, cursor: cursorCustomers };
            const customersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_CUSTOMERS_QUERY, currentParams);
            
            if (customersData?.customers?.edges) {
                for (const edge of customersData.customers.edges) {
                    const node = edge.node;
                    await db.insert(customers).values({
                        tenantId: tenant.id,
                        shopifyId: node.id,
                        firstName: 'Redacted',
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
                customersCount += customersData.customers.edges.length;
                hasNextPageCustomers = customersData.customers.pageInfo.hasNextPage;
                cursorCustomers = customersData.customers.pageInfo.endCursor;
            } else {
                hasNextPageCustomers = false;
            }
        }

        // --- PRODUCTS ---
        let hasNextPageProducts = true;
        let cursorProducts = null;
        let productsCount = 0;

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
                productsCount += productsData.products.edges.length;
                hasNextPageProducts = productsData.products.pageInfo.hasNextPage;
                cursorProducts = productsData.products.pageInfo.endCursor;
            } else {
                hasNextPageProducts = false;
            }
        }

        // --- ORDERS ---
        let hasNextPageOrders = true;
        let cursorOrders = null;
        let ordersCount = 0;

        while (hasNextPageOrders) {
            const currentParams: any = { ...queryParams, cursor: cursorOrders };
            const ordersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_ORDERS_QUERY, currentParams);

            if (ordersData?.orders?.edges) {
                for (const edge of ordersData.orders.edges) {
                    const node = edge.node;
                    
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
                ordersCount += ordersData.orders.edges.length;
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

        results.push({
            tenant: tenant.storeDomain,
            status: 'success',
            counts: { customers: customersCount, products: productsCount, orders: ordersCount }
        });

      } catch (error: any) {
        console.error(` Ingestion Failed for ${tenant.storeDomain}:`, error);
        results.push({ tenant: tenant.storeDomain, status: 'failed', error: error.message });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('Cron Job Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
