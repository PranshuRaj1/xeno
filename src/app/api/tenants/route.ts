import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeName, storeDomain, accessToken } = body;

    if (!storeName || !storeDomain || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newTenant = await db.insert(tenants).values({
      storeName,
      storeDomain,
      accessToken,
    }).returning();

    return NextResponse.json(newTenant[0]);
  } catch (error: any) {
    console.error('Failed to create tenant:', error);
    return NextResponse.json({ error: 'Failed to create tenant', details: error.message }, { status: 500 });
  }
}
