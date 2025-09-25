import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { loadAlertThresholdsAction, saveAlertThresholdsAction } from '@/lib/actions/settings-actions';

export async function GET() {
  try {
    const s = await loadAlertThresholdsAction();
    return NextResponse.json(s || {}, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[API] GET /api/settings/thresholds error', err);
    return NextResponse.json({ error: 'Error al cargar umbrales' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = {
      daysThreshold: Number(body?.daysThreshold),
      mileageThreshold: Number(body?.mileageThreshold),
      lowEfficiencyThresholdKmPerGallon: Number(body?.lowEfficiencyThresholdKmPerGallon),
      highMaintenanceCostThreshold: Number(body?.highMaintenanceCostThreshold),
      maintenanceCostWindowDays: Number(body?.maintenanceCostWindowDays),
    };
  const res = await saveAlertThresholdsAction(payload);
  if (!res?.success) return NextResponse.json({ success: false }, { status: 500 });
  // After saving, load the current thresholds to return them in response
  const latest = await loadAlertThresholdsAction();
  revalidatePath('/settings');
  return NextResponse.json({ success: true, data: latest || payload });
  } catch (err) {
    console.error('[API] POST /api/settings/thresholds error', err);
    return NextResponse.json({ error: 'Error al guardar umbrales' }, { status: 500 });
  }
}
