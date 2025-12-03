import 'dotenv/config';
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function checkCustomers() {
    const tenantId = 9; // Assuming tenant ID 9 based on previous logs
    const result = await db.select({ count: sql<number>`count(*)` }).from(customers).where(eq(customers.tenantId, tenantId));
    console.log(`Total customers for tenant ${tenantId}:`, result[0].count);
    
    const top5 = await db.query.customers.findMany({
        where: eq(customers.tenantId, tenantId),
        limit: 10,
    });
    console.log(`Actual records found: ${top5.length}`);
}

checkCustomers();
