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
        const { tenantId } = JSON.parse(msg.content.toString());
        console.log(`\n Received task for tenant: ${tenantId}`);
        
        await ingestForTenant(tenantId);
        
        ch.ack(msg); // Acknowledge success
        console.log(` Task completed for ${tenantId}`);
      } catch (error) {
        console.error(` Task failed for message:`, error);
        // We can create a Dead Letter Exchange or just nack with requeue=false if we want to drop it
        // For now, let's just log it and ack it so we don't loop forever on a bad message
        // Or un-ack to retry: ch.nack(msg);
        ch.ack(msg); 
      }
    });
  } catch (error) {
    console.error("Worker failed to start:", error);
    process.exit(1);
  }
}

startWorker().catch(console.error);
