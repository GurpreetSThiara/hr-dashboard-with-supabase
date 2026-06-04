/**
 * GET /api/organization/chart
 *
 * Returns the full reporting tree (top-down), built from employees.manager
 * (email) relationships. Public fields only. Authenticated users.
 *
 * Response: { roots: TreeNode[] } where TreeNode = { id, name, emp_id,
 *   designation, department, location, email, reports: TreeNode[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

interface TreeNode {
  id: string; emp_id: string; name: string; email: string;
  designation: string; department: string; location: string | null;
  reports: TreeNode[];
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const tree = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT id, emp_id, first_name, last_name, email, designation, department, location, manager
        FROM employees
        WHERE deleted_at IS NULL AND status = 'active'
        ORDER BY first_name, last_name
      `);

      const rows = res.rows;
      const byEmail = new Map<string, TreeNode>();
      const nodes: TreeNode[] = rows.map((r: any) => {
        const node: TreeNode = {
          id: r.id, emp_id: r.emp_id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          email: r.email, designation: r.designation,
          department: r.department, location: r.location,
          reports: [],
        };
        if (r.email) byEmail.set(r.email.toLowerCase(), node);
        return node;
      });

      const roots: TreeNode[] = [];
      rows.forEach((r: any, i: number) => {
        const mgr = r.manager ? String(r.manager).toLowerCase() : null;
        const parent = mgr ? byEmail.get(mgr) : null;
        if (parent && parent !== nodes[i]) parent.reports.push(nodes[i]);
        else roots.push(nodes[i]); // no manager, or manager not found → top level
      });

      return { roots };
    });

    return NextResponse.json(tree);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
