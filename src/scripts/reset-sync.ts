
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import '@/lib/env-loader';

async function resetSync() {
  const tenantId = 9; // ID from the logs
  console.log(`Resetting lastSyncedAt for tenant ${tenantId}...`);

  await db.update(tenants)
    .set({ lastSyncedAt: null })
    .where(eq(tenants.id, tenantId));

  console.log('Reset complete. Next sync will be a FULL sync.');
  process.exit(0);
}

resetSync();
