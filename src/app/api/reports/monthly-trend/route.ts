import { NextResponse } from "next/server";
import { getMonthlyCostsTrend } from "@/lib/actions/report-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const vehicleId = searchParams.get("vehicleId") || undefined;

    const data = await getMonthlyCostsTrend({ startDate, endDate, vehicleId });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API] monthly-trend error:", err);
    return NextResponse.json({ error: "Failed to load monthly trend" }, { status: 500 });
  }
}
