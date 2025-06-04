import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/vehicle-form";
import { CarFront } from "lucide-react";
import { createVehicle } from "@/lib/actions/vehicle-actions";
import { Card, CardContent } from "@/components/ui/card";

export default function NewVehiclePage() {
  return (
    <>
      <PageHeader
        title="Agregar Nuevo Vehículo"
        description="Ingresa los detalles del nuevo vehículo para agregarlo a tu flota."
        icon={CarFront}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <VehicleForm onSubmitAction={createVehicle} />
        </CardContent>
      </Card>
    </>
  );
}
