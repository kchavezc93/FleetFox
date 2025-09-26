import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import sql from 'mssql';
import { getCurrentUser } from '@/lib/actions/auth-actions';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'Admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== 'SQLServer' || !(dbClient as any).pool) {
    return NextResponse.json({ ok: false, error: 'DB not available' }, { status: 500 });
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const body = await request.json().catch(() => ({}));
    let vehicleId: string | null = body?.vehicleId ?? null;
    if (typeof vehicleId !== 'string') vehicleId = null;
    vehicleId = vehicleId && vehicleId.trim().length ? vehicleId.trim() : null;

    let fromDate: Date | null = null;
    if (body?.fromDate) {
      const d = new Date(body.fromDate);
      if (!isNaN(d.getTime())) fromDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    const req = pool.request();
    req.input('vehicleId', sql.NVarChar(50), vehicleId);
    req.input('fromDate', sql.Date, fromDate);
    await req.query('EXEC dbo.RecalcFuelEfficiencies @vehicleId, @fromDate;');

    // Revalidate key views
    revalidatePath('/fueling');
    revalidatePath('/fueling/mobile');
    revalidatePath('/reports/fuel-consumption');
  revalidatePath('/reports/fuel-efficiency-analysis');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API] POST /api/settings/recalc-efficiencies error', err);
    return NextResponse.json({ ok: false, error: 'Execution failed' }, { status: 500 });
  }
}
