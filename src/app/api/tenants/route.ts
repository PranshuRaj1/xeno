import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeName, storeDomain, accessToken, clientSecret } = body;

    if (!storeName || !storeDomain || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanStoreDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    const encryptedSecret = clientSecret ? encrypt(clientSecret.trim()) : null;

    const newTenant = await db.insert(tenants).values({
      storeName,
      storeDomain: cleanStoreDomain,
      accessToken: accessToken.trim(),
      clientSecret: encryptedSecret,
    }).onConflictDoUpdate({
        target: tenants.storeDomain,
        set: {
            accessToken: accessToken.trim(),
            storeName: storeName,
            clientSecret: encryptedSecret, // Update secret if provided
            updatedAt: new Date(),
        }
    }).returning();

    console.log("------------------");
    

    console.log(newTenant);

    // Register Webhooks
    const webhooks = [
        { topic: 'orders/create', address: `${process.env.APP_URL}/api/webhooks/shopify` },
        { topic: 'checkouts/create', address: `${process.env.APP_URL}/api/webhooks/shopify` },
        { topic: 'checkouts/update', address: `${process.env.APP_URL}/api/webhooks/shopify` },
    ];

    for (const hook of webhooks) {
        try {
            const webhookRes = await fetch(`https://${storeDomain}/admin/api/2024-01/webhooks.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken,
                },
                body: JSON.stringify({
                    webhook: {
                        topic: hook.topic,
                        address: hook.address,
                        format: 'json',
                    },
                }),
            });
            
            if (!webhookRes.ok) {
                console.error(`Failed to register webhook ${hook.topic}:`, await webhookRes.text());
            } else {
                console.log(`Registered webhook: ${hook.topic}`);
            }
        } catch (err) {
            console.error(`Error registering webhook ${hook.topic}:`, err);
        }
    }

    return NextResponse.json(newTenant[0]);
  } catch (error: any) {
    console.error('Failed to create tenant:', error);
    return NextResponse.json({ error: 'Failed to create tenant', details: error.message }, { status: 500 });
  }
}
