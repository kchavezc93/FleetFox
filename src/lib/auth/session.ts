import { cookies } from "next/headers";
import { getDbClient } from "@/lib/db";
import sql from "mssql";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  role: "Admin" | "Standard";
  permissions: string[];
} | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return null;

    const dbClient = await getDbClient();
    if (!(dbClient?.type === "SQLServer") || !(dbClient as any).pool) return null;

    const pool = (dbClient as any).pool as sql.ConnectionPool;
    const req = pool.request();
    req.input("token", sql.NVarChar(128), token);
    const result = await req.query(`
      SELECT u.id, u.username, u.email, u.role, u.permissions
      FROM sessions s
      JOIN users u ON u.id = s.userId
      WHERE s.token = @token AND s.expiresAt > GETDATE()
    `);
    if (!result.recordset.length) return null;
    const row = result.recordset[0];
    return {
      id: row.id?.toString?.() ?? String(row.id),
      username: row.username,
      email: row.email,
      role: row.role as "Admin" | "Standard",
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
    };
  } catch {
    return null;
  }
}
