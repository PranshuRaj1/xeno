import '@/lib/env-loader';
import { db } from '@/db';
import { tenants } from '@/db/schema';

async function listTenants() {
  console.log('Listing all tenants...');
  const allTenants = await db.select().from(tenants);
  console.log(JSON.stringify(allTenants, null, 2));
  process.exit(0);
}

listTenants();
