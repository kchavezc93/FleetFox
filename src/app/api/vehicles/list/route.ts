import { NextRequest } from "next/server";
import { getVehicles } from "@/lib/actions/vehicle-actions";

export async function GET(_req: NextRequest) {
  const vehicles = await getVehicles();
  // Return minimal fields for dropdowns
  const rows = vehicles.map(v => ({ id: v.id, plateNumber: v.plateNumber, brand: v.brand, model: v.model }));
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
