import { requirePermission } from "@/lib/authz";
import { getFuelingLogById, updateFuelingLog } from "@/lib/actions/fueling-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { FuelingForm } from "@/components/fueling-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function MobileFuelingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission('/fueling-mobile');
  const [log, vehicles] = await Promise.all([
    getFuelingLogById(id),
    getVehicles(),
  ]);
  if (!log) notFound();
  const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');
  const displayVehicles = vehicles.filter(v => (v.status === 'Activo' || v.status === 'En Taller') || v.id === log!.vehicleId);

  async function submit(data: any) {
    "use server";
    return await updateFuelingLog(id, data);
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/fueling/mobile"><Button variant="secondary" size="sm">Volver</Button></Link>
      </div>
      <FuelingForm
        vehicles={displayVehicles}
        onSubmitAction={submit as any}
  redirectPath={`/fueling/mobile/${id}`}
        initial={{
          id,
          vehicleId: log!.vehicleId,
          fuelingDate: new Date(log!.fuelingDate + 'T00:00:00'),
          mileageAtFueling: log!.mileageAtFueling,
          quantityLiters: log!.quantityLiters,
          costPerLiter: log!.costPerLiter,
          totalCost: log!.totalCost,
          station: log!.station,
          responsible: log!.responsible,
          imageUrl: log!.imageUrl,
        }}
        existingVouchers={(log!.vouchers || []).map(v => ({ id: v.id, fileName: v.fileName, fileContent: v.fileContent }))}
        submitLabel="Guardar"
      />
    </div>
  );
}
