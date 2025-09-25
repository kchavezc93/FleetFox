import { PageHeader } from "@/components/page-header";
import { FuelingForm } from "@/components/fueling-form";
import { Fuel } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { createFuelingLog } from "@/lib/actions/fueling-actions";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewFuelingPage() {
  const vehicles = await getVehicles();
  const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');

  return (
    <>
      <PageHeader
        title="Registrar Nueva Carga de Combustible"
        description="Registra una compra de combustible y actualiza el millaje del vehículo."
        icon={Fuel}
        actions={
          <Link href="/fueling">
            <Button variant="outline">Volver al listado</Button>
          </Link>
        }
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <FuelingForm vehicles={activeVehicles} onSubmitAction={createFuelingLog} />
        </CardContent>
      </Card>
    </>
  );
}
