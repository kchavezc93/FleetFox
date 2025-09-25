import { NextRequest, NextResponse } from "next/server";
import { getPeriodOverPeriodSummary } from "@/lib/actions/report-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const vehicleId = searchParams.get("vehicleId") || undefined;
    const data = await getPeriodOverPeriodSummary({ startDate, endDate, vehicleId });
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("/api/reports/period-over-period error:", err);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}
