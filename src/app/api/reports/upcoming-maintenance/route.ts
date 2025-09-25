import { NextRequest } from "next/server";
import { getUpcomingMaintenance } from "@/lib/actions/report-actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const daysThreshold = searchParams.get("daysThreshold");
  const mileageThreshold = searchParams.get("mileageThreshold");
  const vehicleId = searchParams.get("vehicleId") || undefined;
  const data = await getUpcomingMaintenance({
    daysThreshold: daysThreshold ? parseInt(daysThreshold, 10) : undefined,
    mileageThreshold: mileageThreshold ? parseInt(mileageThreshold, 10) : undefined,
    vehicleId,
  });
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
