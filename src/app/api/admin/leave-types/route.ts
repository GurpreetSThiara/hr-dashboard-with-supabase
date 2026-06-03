import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, requireManagePolicies, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const types = await withPgClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM leave_types ORDER BY name ASC'
      );
      return res.rows;
    });
    return NextResponse.json({ types });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireManagePolicies(request);
    const body = await request.json();
    const { name, description, color, requires_document } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const type = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO leave_types (name, description, color, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [name.trim(), description || null, color || '#3b82f6', requires_document || false]
      );
      return res.rows[0];
    });

    return NextResponse.json({ type }, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    if (error.message?.includes('unique') || error.code === '23505') {
      return NextResponse.json({ error: 'A leave type with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
