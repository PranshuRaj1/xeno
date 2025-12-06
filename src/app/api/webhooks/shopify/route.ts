import { NextResponse } from 'next/server';
import { db } from '@/db';
import { checkouts, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { decrypt } from '@/lib/encryption';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const topic = req.headers.get('x-shopify-topic') || '';
    const hmac = req.headers.get('x-shopify-hmac-sha256') || '';
    const shopDomain = req.headers.get('x-shopify-shop-domain') || '';

    console.log(`\n--- WEBHOOK RECEIVED ---`);
    console.log(`Topic: ${topic}`);
    console.log(`Domain: ${shopDomain}`);
    console.log(`HMAC: ${hmac}`);
    console.log(`Body (first 200 chars): ${rawBody.substring(0, 200)}...`);
    console.log(`------------------------\n`);

    // Find Tenant (Handle potential https:// prefix in DB or header)
    // The header usually comes as "store.myshopify.com"
    const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Try finding exact match or match with https:// prefix just in case
    const allTenants = await db.select().from(tenants);
    const tenant = allTenants.find(t => {
        const tDomain = t.storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return tDomain === cleanDomain;
    });

    if (!tenant) {
      console.error(`Tenant not found for domain: ${shopDomain} (Clean: ${cleanDomain})`);
      // Log available tenants for debugging
      console.error(`Available tenants: ${allTenants.map(t => t.storeDomain).join(', ')}`);
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 });
    }

    
    // 2. Verify HMAC
    let secret = process.env.SHOPIFY_API_SECRET;

    if (tenant.clientSecret) {
        try {
            secret = decrypt(tenant.clientSecret);
        } catch (err) {
            console.error('Failed to decrypt client secret:', err);
        }
    }

    if (!secret) {
        console.error(`No clientSecret found for tenant ${tenant.storeDomain} and no global SHOPIFY_API_SECRET set.`);
        return NextResponse.json({ message: 'Configuration Error: Missing Secret' }, { status: 500 });
    }

    const hash = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('base64');
    
    if (hash !== hmac) {
        console.error(`Invalid HMAC signature for ${tenant.storeDomain}`);
        return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(rawBody);

    // 3. Handle Topics
    if (topic === 'checkouts/create' || topic === 'checkouts/update') {
        await db.insert(checkouts).values({
            tenantId: tenant.id,
            shopifyId: data.id.toString(),
            cartToken: data.cart_token,
            email: data.email,
            totalPrice: data.total_price,
            currency: data.currency,
            abandoned: false, // Active checkout
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
        }).onConflictDoUpdate({
            target: [checkouts.shopifyId, checkouts.tenantId],
            set: {
                email: data.email,
                totalPrice: data.total_price,
                updatedAt: new Date(),
                abandoned: false, // Still active
            }
        });
        console.log(`Checkout processed: ${data.id}`);
    }

    return NextResponse.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
