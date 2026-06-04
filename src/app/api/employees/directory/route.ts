/**
 * GET /api/employees/directory
 *
 * The company Employee Directory — available to ANY authenticated employee.
 * Returns ONLY public fields (never salary, contact-private, IDs, etc.), and
 * only active, non-deleted employees. Supports search + filters.
 *
 * Query params: q (name/emp_id/email), department, designation, location,
 *               manager, page, limit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';
import { PUBLIC_DIRECTORY_COLUMNS } from '@/lib/employeeFields';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const department = searchParams.get('department')?.trim();
    const designation = searchParams.get('designation')?.trim();
    const location = searchParams.get('location')?.trim();
    const manager = searchParams.get('manager')?.trim();
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const offset = (page - 1) * limit;

    const result = await withPgClient(async (client) => {
      const conds: string[] = [`deleted_at IS NULL`, `status <> 'terminated'`];
      const vals: any[] = [];

      if (q) {
        vals.push(`%${q.toLowerCase()}%`);
        const p = `$${vals.length}`;
        conds.push(`(LOWER(first_name) LIKE ${p} OR LOWER(last_name) LIKE ${p}
                     OR LOWER(emp_id) LIKE ${p} OR LOWER(email) LIKE ${p}
                     OR LOWER(first_name || ' ' || last_name) LIKE ${p})`);
      }
      if (department) { vals.push(department); conds.push(`department = $${vals.length}`); }
      if (designation) { vals.push(designation); conds.push(`designation = $${vals.length}`); }
      if (location) { vals.push(location); conds.push(`location = $${vals.length}`); }
      if (manager) { vals.push(manager.toLowerCase()); conds.push(`LOWER(manager) = $${vals.length}`); }

      const where = `WHERE ${conds.join(' AND ')}`;

      const countRes = await client.query(`SELECT COUNT(*) FROM employees ${where}`, vals);
      // Only public columns are ever selected — field security at the query level.
      const dataRes = await client.query(
        `SELECT ${PUBLIC_DIRECTORY_COLUMNS} FROM employees ${where}
         ORDER BY first_name ASC, last_name ASC LIMIT ${limit} OFFSET ${offset}`,
        vals
      );

      return {
        data: dataRes.rows,
        pagination: {
          page, limit,
          total: parseInt(countRes.rows[0].count),
          pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
        },
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
