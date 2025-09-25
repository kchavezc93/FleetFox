
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VehicleForm } from "@/components/vehicle-form";
import { CarFront } from "lucide-react";
import { getVehicleById, updateVehicle } from "@/lib/actions/vehicle-actions"; // Removed deleteVehicle import
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import type { VehicleFormData } from "@/types";

export default async function EditVehiclePage({ params }: { params: { id: string } }) {
  const vehicle = await getVehicleById(params.id);

  if (!vehicle) {
    notFound();
  }
  
  // Bind the vehicle id to the updateVehicle server action
  const boundUpdateVehicleAction = updateVehicle.bind(null, params.id);

  return (
    <>
      <PageHeader
        title="Editar Vehículo"
        description={`Actualiza los detalles del vehículo con matrícula ${vehicle.plateNumber}.`}
        icon={CarFront}
        actions={
          <Button asChild variant="outline">
            <Link href="/vehicles">Regresar</Link>
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <VehicleForm 
            vehicle={vehicle} 
            onSubmitAction={boundUpdateVehicleAction} 
            // onDeleteAction is no longer passed
          />
        </CardContent>
      </Card>
    </>
  );
}
