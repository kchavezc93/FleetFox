import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Fuel, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getFuelingLogById, deleteFuelingLog } from "@/lib/actions/fueling-actions";
import { requirePermission } from "@/lib/authz";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { VoucherGallery } from "@/components/voucher-gallery";

const LITERS_PER_GALLON = 3.78541;

export default async function FuelingDetailsPage({ params }: { params: { id: string } }) {
  await requirePermission('/fueling');
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
            <Link href="/fueling">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" /> Regresar
              </Button>
            </Link>
            <Link href={`/fueling/${log.id}/edit`}>
              <Button variant="outline">Editar</Button>
            </Link>
            <form action={async () => { "use server"; await deleteFuelingLog(log.id); }}>
              <ConfirmSubmitButton variant="destructive" confirmMessage="¿Eliminar este registro de combustible?">
                Eliminar
              </ConfirmSubmitButton>
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
            <div className="font-medium">{formatDateDDMMYYYY(log.fuelingDate)}</div>
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
          <div>
            <div className="text-sm text-muted-foreground">Responsable</div>
            <div className="font-medium">{log.responsible}</div>
          </div>
          {/* Vista previa con modal/lightbox */}
          {log.vouchers && log.vouchers.length > 0 && (
            <VoucherGallery vouchers={log.vouchers as any} fuelingLogId={log.id} />
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
