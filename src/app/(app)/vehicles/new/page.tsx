import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/vehicle-form";
import { CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createVehicle } from "@/lib/actions/vehicle-actions";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/authz";

export default async function NewVehiclePage() {
  await requirePermission('/vehicles');
  return (
    <>
      <PageHeader
        title="Agregar Nuevo Vehículo"
        description="Ingresa los detalles del nuevo vehículo para agregarlo a tu flota."
        icon={CarFront}
        actions={
          <Button asChild variant="outline">
            <Link href="/vehicles">Regresar</Link>
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <VehicleForm onSubmitAction={createVehicle} />
        </CardContent>
      </Card>
    </>
  );
}
