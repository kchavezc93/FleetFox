import { NextRequest, NextResponse } from 'next/server';
import { deleteFuelingVoucher } from '@/lib/actions/fueling-actions';

export async function POST(req: NextRequest) {
  try {
    const { voucherId, logId } = await req.json();
    if (!voucherId || !logId) {
      return NextResponse.json({ success: false, message: 'voucherId y logId son requeridos.' }, { status: 400 });
    }
    const res = await deleteFuelingVoucher(String(voucherId), String(logId));
    const status = res.success ? 200 : 500;
    return NextResponse.json(res, { status });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
