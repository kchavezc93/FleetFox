
import { PageHeader } from "@/components/page-header";
import { MaintenanceForm } from "@/components/maintenance-form";
import { Wrench } from "lucide-react";
import { getMaintenanceLogById, updateMaintenanceLog } from "@/lib/actions/maintenance-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
// Removed: import type { MaintenanceFormData } from "@/types";

// export default async function EditMaintenanceLogPage({ params }: { params: { id: string } }) {
//   const maintenanceLog = await getMaintenanceLogById(params.id);
//   const vehicles = await getVehicles(); // Fetch all vehicles for the dropdown
//   const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');
  export default async function EditMaintenanceLogPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;

    const [maintenanceLog, vehicles] = await Promise.all([
      getMaintenanceLogById(id),
      getVehicles(),
    ]);

    const activeVehicles = vehicles.filter(
      (v) => v.status === "Activo" || v.status === "En Taller"
    );

  if (!maintenanceLog) {
    notFound();
  }
  
  // The server action 'updateMaintenanceLog' expects (id, formData).
  // We bind the 'params.id' to it, so MaintenanceForm can call it with just 'formData'.
  const boundUpdateMaintenanceLog = updateMaintenanceLog.bind(null, id);

  return (
    <>
      <PageHeader
        title="Editar Registro de Mantenimiento"
        description={`Actualiza los detalles del registro de mantenimiento para ${maintenanceLog.vehiclePlateNumber}.`}
        icon={Wrench}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <MaintenanceForm 
            maintenanceLog={maintenanceLog} 
            vehicles={activeVehicles} // Pass active vehicles
            onSubmitAction={boundUpdateMaintenanceLog} 
          />
        </CardContent>
      </Card>
    </>
  );
}
