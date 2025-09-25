"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth-actions";
import { cookies } from 'next/headers';

// Require that current user has a given permission key (or is Admin).
// Keys recommended: "/dashboard", "/vehicles", "/maintenance", "/fueling", "/fueling-mobile", "/reports", "/alerts", "/users", "/settings"
export async function requirePermission(key: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "Admin") return;
  // Load full user from DB for permissions if needed in future; for now, rely on layout injecting SidebarNav correctly.
  // To avoid another DB call, let pages pass; but better approach: add permissions into sessions table in future.
  // For now, fetch permissions via a lightweight server action in layout and share via context would be ideal; we reuse layout's query.
  // As a compromise: permissive allow for Standard unless explicit deny list? We implement strict check using a fresh read:
  const { getDbClient } = await import("@/lib/db");
  const sql = (await import("mssql")).default;
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) redirect("/login");
  const pool = (dbClient as any).pool as any;
  // Query user permissions
  const req = pool.request();
  req.input('id', (sql as any).NVarChar(50), user.id);
  const res = await req.query('SELECT permissions, role FROM users WHERE id = @id');
  if (!res.recordset.length) redirect('/login');
  const row = res.recordset[0];
  if (row.role === 'Admin') return;
  const permissions: string[] = row.permissions ? JSON.parse(row.permissions) : [];
  const permsLower = Array.isArray(permissions) ? permissions.map((p: string) => (p || '').toLowerCase()) : [];
  const keyLower = (key || '').toLowerCase();
  let allowed = permsLower.includes(keyLower);
  // Safety net: allow kiosk scope users (perm_scope cookie) into mobile fueling
  if (!allowed && keyLower === '/fueling-mobile') {
    if (!allowed) {
      try {
        const cookieStore = await cookies();
        const scope = cookieStore.get('perm_scope')?.value || '';
        if (scope === 'fueling-only') {
          allowed = true;
        }
      } catch {}
    }
  }
  if (!allowed) redirect('/forbidden');
}
