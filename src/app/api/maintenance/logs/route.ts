import { NextRequest } from "next/server";
import { getMaintenanceLogs, getMaintenanceLogsFiltered } from "@/lib/actions/maintenance-actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const hasFilters = Boolean(vehicleId || from || to);
  const logs = hasFilters
    ? await getMaintenanceLogsFiltered({ vehicleId, from, to })
    : await getMaintenanceLogs();
  return new Response(JSON.stringify(logs), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
