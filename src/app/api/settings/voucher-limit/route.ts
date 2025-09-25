import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";
import sql from "mssql";

export async function GET() {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) {
    return NextResponse.json({ voucherMaxPerFueling: null }, { status: 200 });
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const colCheck = await pool.request().query(`SELECT COL_LENGTH('settings','voucher_max_per_fueling') AS hasCol;`);
    const hasCol = !!colCheck.recordset?.[0]?.hasCol;
    if (!hasCol) return NextResponse.json({ voucherMaxPerFueling: null }, { status: 200 });
    const res = await pool.request().query(`SELECT TOP 1 voucher_max_per_fueling AS maxV FROM settings;`);
    return NextResponse.json({ voucherMaxPerFueling: res.recordset?.[0]?.maxV ?? null }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ voucherMaxPerFueling: null }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const payload = await req.json();
    const n = Number(payload?.voucherMaxPerFueling);
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ ok: false, error: 'Valor inválido' }, { status: 400 });

    const hasRow = await pool.request().query(`SELECT TOP 1 1 AS x FROM settings;`);
    const colCheck = await pool.request().query(`SELECT COL_LENGTH('settings','voucher_max_per_fueling') AS hasCol;`);
    const hasCol = !!colCheck.recordset?.[0]?.hasCol;
    if (!hasCol) return NextResponse.json({ ok: false, error: 'Columna no existe' }, { status: 400 });

    if (hasRow.recordset?.length) {
      const reqUpd = pool.request();
      reqUpd.input('v', sql.Int, n);
      await reqUpd.query(`UPDATE settings SET voucher_max_per_fueling = @v;`);
    } else {
      const reqIns = pool.request();
      reqIns.input('v', sql.Int, n);
      await reqIns.query(`INSERT INTO settings (voucher_max_per_fueling) VALUES (@v);`);
    }
    return NextResponse.json({ ok: true, data: { voucherMaxPerFueling: n } }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
