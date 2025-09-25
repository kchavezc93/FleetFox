import { NextRequest } from "next/server";
import { getFuelEfficiencyStats } from "@/lib/actions/report-actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const vehicleId = searchParams.get("vehicleId") || undefined;
  const data = await getFuelEfficiencyStats({ startDate, endDate, vehicleId });
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
