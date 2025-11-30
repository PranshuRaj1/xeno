import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, customers, products, orders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchShopify, GET_CUSTOMERS_QUERY, GET_PRODUCTS_QUERY, GET_ORDERS_QUERY } from '@/lib/shopify';

export async function POST(request: Request) {
  try {
    const { tenantId } = await request.json();

    if (!tenantId) {
        return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 1. Sync Customers
    const customersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_CUSTOMERS_QUERY, { first: 10 });
    if (customersData?.customers?.edges) {
        for (const edge of customersData.customers.edges) {
        const node = edge.node;
        await db.insert(customers).values({
            tenantId: tenant.id,
            shopifyId: node.id,
            firstName: node.firstName,
            lastName: node.lastName,
            email: node.email,
            totalSpent: node.amountSpent?.amount || '0',
            ordersCount: node.ordersCount,
            createdAt: new Date(node.createdAt),
        }).onConflictDoUpdate({
            target: [customers.shopifyId, customers.tenantId],
            set: {
            totalSpent: node.amountSpent?.amount || '0',
            ordersCount: node.ordersCount,
            updatedAt: new Date(),
            }
        });
        }
    }

    // 2. Sync Products
    const productsData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_PRODUCTS_QUERY, { first: 10 });
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
    const ordersData = await fetchShopify(tenant.storeDomain, tenant.accessToken, GET_ORDERS_QUERY, { first: 10 });
    if (ordersData?.orders?.edges) {
        for (const edge of ordersData.orders.edges) {
            const node = edge.node;
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
                    financialStatus: node.displayFinancialStatus,
                    fulfillmentStatus: node.displayFulfillmentStatus,
                }
            });
        }
    }

    return NextResponse.json({ success: true, message: 'Sync completed successfully' });
  } catch (error: any) {
    console.error('Sync failed:', error);
    return NextResponse.json({ error: 'Sync failed', details: error.message }, { status: 500 });
  }
}
