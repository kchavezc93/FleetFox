import { PageHeader } from "@/components/page-header";
import { MaintenanceForm } from "@/components/maintenance-form";
import { Wrench } from "lucide-react";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { createMaintenanceLog } from "@/lib/actions/maintenance-actions";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/authz";
import { redirect } from "next/navigation";
// Props compatible with Next 15 PageProps shape used by typegen
type NextPageProps = { params?: Promise<any>; searchParams?: Promise<any> };

export default async function NewMaintenancePage(_props: NextPageProps) {
  await requirePermission('/maintenance');
  const vehicles = await getVehicles();
  // Include all vehicles so a prefilled vehicleId from query always exists in the options
  const activeVehicles = vehicles;

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
