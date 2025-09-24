import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Fuel } from "lucide-react";
import { getFuelingLogById, updateFuelingLog } from "@/lib/actions/fueling-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { FuelingForm } from "@/components/fueling-form";
import { notFound } from "next/navigation";

export default async function EditFuelingPage({ params }: { params: { id: string } }) {
  const [log, vehicles] = await Promise.all([
    getFuelingLogById(params.id),
    getVehicles(),
  ]);
  if (!log) notFound();
  const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');

  async function submit(data: any) {
    "use server";
    return await updateFuelingLog(params.id, data);
  }

  return (
    <>
      <PageHeader
        title="Editar Registro de Combustible"
        description={`Vehículo: ${log!.vehiclePlateNumber || log!.vehicleId}`}
        icon={Fuel}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <FuelingForm
            vehicles={activeVehicles}
            onSubmitAction={submit as any}
            initial={{
              vehicleId: log!.vehicleId,
              fuelingDate: new Date(log!.fuelingDate + 'T00:00:00'),
              mileageAtFueling: log!.mileageAtFueling,
              quantityLiters: log!.quantityLiters,
              costPerLiter: log!.costPerLiter,
              totalCost: log!.totalCost,
              station: log!.station,
              imageUrl: log!.imageUrl,
            }}
            submitLabel="Guardar Cambios"
          />
        </CardContent>
      </Card>
    </>
  );
}
