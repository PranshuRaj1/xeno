
import 'dotenv/config';
import { db } from "@/db";
import { orders, customers, tenants } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

async function main() {
  console.log("Verifying Rates for all tenants...");

  const allTenants = await db.select().from(tenants);

  for (const tenant of allTenants) {
    console.log(`\n--- Tenant: ${tenant.storeName} (ID: ${tenant.id}) ---`);

    // 1. Refund Rate
    const [totalOrdersRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(eq(orders.tenantId, tenant.id));
    const totalOrders = Number(totalOrdersRes?.count || 0);

    const [refundedOrdersRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(
            eq(orders.tenantId, tenant.id), 
            sql`lower(${orders.financialStatus}) LIKE '%refunded%'`
        ));
    const refundedCount = Number(refundedOrdersRes?.count || 0);
    const refundRate = totalOrders > 0 ? (refundedCount / totalOrders) * 100 : 0;

    console.log(`Total Orders: ${totalOrders}`);
    console.log(`Refunded Orders (status like '%refunded%'): ${refundedCount}`);
    console.log(`Calculated Refund Rate: ${refundRate.toFixed(2)}%`);

    // 2. Returning Customer Rate
    const [totalCustomersRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(eq(customers.tenantId, tenant.id));
    const totalCustomers = Number(totalCustomersRes?.count || 0);

    const [returningCustomersRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(eq(customers.tenantId, tenant.id), sql`${customers.ordersCount} > 1`));
    const returningCount = Number(returningCustomersRes?.count || 0);
    const returningRate = totalCustomers > 0 ? (returningCount / totalCustomers) * 100 : 0;

    console.log(`Total Customers: ${totalCustomers}`);
    console.log(`Returning Customers (>1 order): ${returningCount}`);
    console.log(`Calculated Returning Rate: ${returningRate.toFixed(2)}%`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
