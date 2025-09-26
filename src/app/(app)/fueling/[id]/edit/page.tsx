import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Fuel } from "lucide-react";
import { getFuelingLogById, updateFuelingLog } from "@/lib/actions/fueling-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { FuelingForm } from "@/components/fueling-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/authz";

export default async function EditFuelingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission('/fueling');
  const [log, vehicles] = await Promise.all([
    getFuelingLogById(id),
    getVehicles(),
  ]);
  if (!log) notFound();
  // Mostrar activos + el vehículo del registro (aunque esté inactivo) para que aparezca seleccionado
  const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');
  const displayVehicles = vehicles.filter(v => (v.status === 'Activo' || v.status === 'En Taller') || v.id === log!.vehicleId);

  async function submit(data: any) {
    "use server";
  return await updateFuelingLog(id, data);
  }

  return (
    <>
      <PageHeader
        title="Editar Registro de Combustible"
        description={`Vehículo: ${log!.vehiclePlateNumber || log!.vehicleId}`}
        icon={Fuel}
        actions={
          <Link href="/fueling">
            <Button variant="outline">Volver al listado</Button>
          </Link>
        }
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <FuelingForm
            vehicles={displayVehicles}
            onSubmitAction={submit as any}
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
            submitLabel="Guardar Cambios"
          />
        </CardContent>
      </Card>
    </>
  );
}
