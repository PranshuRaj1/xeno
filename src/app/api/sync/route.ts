import { NextResponse } from 'next/server';
import { publishIngestionTask } from '@/lib/rabbitmq';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
        return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    console.log(`Received sync request for tenant: ${tenantId}`);

    // Validate if tenantId is a number
    if (isNaN(Number(tenantId))) {
        return NextResponse.json({ error: 'Invalid tenant ID. Must be a number.' }, { status: 400 });
    }

    // Publish to RabbitMQ
    await publishIngestionTask(tenantId);
    console.log(`Task published to queue for tenant: ${tenantId}`);

    return NextResponse.json({ 
        success: true, 
        message: 'Ingestion task queued successfully. It will be processed in the background.' 
    }, { status: 202 });

  } catch (error: any) {
    console.error('Sync request failed:', error);
    return NextResponse.json({ error: 'Sync request failed', details: error.message }, { status: 500 });
  }
}
