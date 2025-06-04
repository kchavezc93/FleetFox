import { PageHeader } from "@/components/page-header";
import { MaintenanceForm } from "@/components/maintenance-form";
import { Wrench } from "lucide-react";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { createMaintenanceLog } from "@/lib/actions/maintenance-actions";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewMaintenancePage() {
  const vehicles = await getVehicles();
  const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');


  return (
    <>
      <PageHeader
        title="Registrar Nuevo Mantenimiento"
        description="Registra los detalles de una actividad de mantenimiento para un vehículo."
        icon={Wrench}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <MaintenanceForm vehicles={activeVehicles} onSubmitAction={createMaintenanceLog} />
        </CardContent>
      </Card>
    </>
  );
}
