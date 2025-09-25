import { getDbClient } from "@/lib/db";
import sql from "mssql";
import { VOUCHER_MAX_PER_FUELING as DEFAULT_MAX } from "@/lib/config";

export async function getVoucherMaxPerFueling(): Promise<number> {
  try {
    const dbClient = await getDbClient();
    if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return DEFAULT_MAX;
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    // Verificar si existe la columna voucher_max_per_fueling en settings
    const colCheck = await pool.request().query(`
      SELECT COL_LENGTH('settings','voucher_max_per_fueling') AS hasCol;
    `);
    const hasCol = !!colCheck.recordset?.[0]?.hasCol;
    if (!hasCol) return DEFAULT_MAX;
    const res = await pool.request().query(`SELECT TOP 1 voucher_max_per_fueling AS maxV FROM settings;`);
    const v = res.recordset?.[0]?.maxV;
    const n = v != null ? Number(v) : NaN;
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX;
    return n;
  } catch {
    return DEFAULT_MAX;
  }
}
