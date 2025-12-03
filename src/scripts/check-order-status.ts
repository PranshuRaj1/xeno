
import { db } from "@/db";
import { orders } from "@/db/schema";
import { sql } from "drizzle-orm";
import 'dotenv/config';

async function main() {
  console.log("Checking Order Financial Statuses...");

  const statuses = await db
    .select({ 
        status: orders.financialStatus,
        count: sql<number>`count(*)`
    })
    .from(orders)
    .groupBy(orders.financialStatus);

  console.log("Distinct Financial Statuses found:");
  statuses.forEach(s => {
      console.log(`- "${s.status}": ${s.count}`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
