import '@/lib/env-loader'; // Ensure env vars are loaded
import { getChannel } from '@/lib/rabbitmq';
import { ingestForTenant } from '@/lib/ingest-service';

async function startWorker() {
  console.log(" Worker started...");
  
  try {
    const ch = await getChannel();
    const QUEUE_NAME = 'ingestion-queue'; // Ensure matches rabbitmq.ts

    console.log(` Waiting for messages in ${QUEUE_NAME}. To exit press CTRL+C`);
    
    // Prefetch 1 message at a time to ensure fair dispatch if we have multiple workers
    ch.prefetch(1);

    ch.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());
        const { tenantId, retryCount = 0 } = payload;
        const MAX_RETRIES = 3;

        console.log(`\n Received task for tenant: ${tenantId} (Attempt: ${retryCount + 1}/${MAX_RETRIES + 1})`);
        
        await ingestForTenant(tenantId);
        
        ch.ack(msg); // Acknowledge success
        console.log(` Task completed for ${tenantId}`);
      } catch (error) {
        console.error(` Task failed for message:`, error);
        
        const payload = JSON.parse(msg.content.toString());
        const { tenantId, retryCount = 0 } = payload;
        const MAX_RETRIES = 3;

        if (retryCount < MAX_RETRIES) {
             console.log(` Re-queueing task for tenant ${tenantId} in 5 seconds...`);
             // Wait 5s before re-queueing (simple backoff)
             await new Promise(r => setTimeout(r, 5000));
             
             // We need to import publishIngestionTask but since we are in worker.ts which imports from lib usually...
             // Let's rely on the fact that we can interact with the channel directly OR import the publisher.
             // Importing publisher is cleaner to keep logic encapsulated.
             const { publishIngestionTask } = await import('@/lib/rabbitmq');
             await publishIngestionTask(tenantId, retryCount + 1);
        } else {
             console.error(` CRIMINAL: Max retries reached for tenant ${tenantId}. Task dropped.`);
             // Here we would push to a Dead Letter Queue or DB table for failed jobs
        }
        
        ch.ack(msg); // Always ack the original message so it doesn't stay in the original queue head
      }
    });
  } catch (error) {
    console.error("Worker failed to start:", error);
    process.exit(1);
  }
}

startWorker().catch(console.error);
