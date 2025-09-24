import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Fuel } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getFuelingLogById, deleteFuelingLog } from "@/lib/actions/fueling-actions";
import { format } from "date-fns";

const LITERS_PER_GALLON = 3.78541;

export default async function FuelingDetailsPage({ params }: { params: { id: string } }) {
  const log = await getFuelingLogById(params.id);
  if (!log) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Registro no encontrado.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Detalle de Carga de Combustible`}
        description={`Vehículo: ${log.vehiclePlateNumber || log.vehicleId}`}
        icon={Fuel}
        actions={
          <div className="flex gap-2">
            <Link href={`/fueling/${log.id}/edit`}>
              <Button variant="outline">Editar</Button>
            </Link>
            <form action={async () => { "use server"; await deleteFuelingLog(log.id); }}>
              <Button
                type="submit"
                variant="destructive"
                onClick={(e) => { if (!confirm('¿Eliminar este registro de combustible?')) { e.preventDefault(); } }}
              >
                Eliminar
              </Button>
            </form>
          </div>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Información</CardTitle>
          <CardDescription>Detalle completo del registro.</CardDescription>
        </CardHeader>
  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div>
            <div className="text-sm text-muted-foreground">Fecha</div>
            <div className="font-medium">{format(new Date(log.fuelingDate), 'PP')}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Millaje</div>
            <div className="font-medium">{log.mileageAtFueling.toLocaleString()} km</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Galones</div>
            <div className="font-medium">{(log.quantityLiters / LITERS_PER_GALLON).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Costo/Galón</div>
            <div className="font-medium">C${(log.costPerLiter * LITERS_PER_GALLON).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Costo Total</div>
            <div className="font-medium">C${log.totalCost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Eficiencia</div>
            <div className="font-medium">{log.fuelEfficiencyKmPerGallon != null ? `${log.fuelEfficiencyKmPerGallon.toFixed(1)} km/gal` : 'N/A'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground">Estación</div>
            <div className="font-medium">{log.station}</div>
          </div>
          {log.imageUrl && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">Recibo</div>
              <a href={log.imageUrl} target="_blank" className="text-primary underline">Ver imagen</a>
            </div>
          )}
          {(log.createdByUsername || log.createdByUserId) && (
            <div>
              <div className="text-sm text-muted-foreground">Creado por</div>
              <div className="font-medium">{log.createdByUsername ?? `Usuario #${log.createdByUserId}`}</div>
            </div>
          )}
          {(log.updatedByUsername || log.updatedByUserId) && (
            <div>
              <div className="text-sm text-muted-foreground">Actualizado por</div>
              <div className="font-medium">{log.updatedByUsername ?? `Usuario #${log.updatedByUserId}`}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
