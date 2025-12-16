import * as amqp from 'amqplib'

const QUEUE_NAME = 'ingestion-queue';
let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

export async function getChannel() {
  if (channel) return channel;
  
  if (!process.env.RABBITMQ_URL) throw new Error("RABBITMQ_URL missing. Please set it in .env");

  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    
    // Handle connection close
    connection.on('close', () => {
        console.error('RabbitMQ connection closed');
        connection = null;
        channel = null;
    });

    connection.on('error', (err) => {
        console.error('RabbitMQ connection error', err);
        connection = null;
        channel = null;
    });

    return channel;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ", error);
    throw error;
  }
}

export async function publishIngestionTask(tenantId: string) {
  try {
    const ch = await getChannel();
    const msg = JSON.stringify({ tenantId });
    return ch.sendToQueue(QUEUE_NAME, Buffer.from(msg), { persistent: true });
  } catch (error) {
    console.error("Failed to publish task", error);
    throw error;
  }
}
