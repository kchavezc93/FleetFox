
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Fuel, PlusCircle, FileDown, MoreHorizontal, Filter } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFuelingLogs, getFuelingLogsFiltered, deleteFuelingLog } from "@/lib/actions/fueling-actions";
import { format } from "date-fns";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { FuelingExportButtons } from "@/components/fueling-export";
import FuelingFilters from "@/components/fueling-filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToXLSX } from "@/lib/export-excel";
import { cookies } from "next/headers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requirePermission } from "@/lib/authz";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ConfirmSubmitMenuItem } from "@/components/confirm-submit-menu-item";

const LITERS_PER_GALLON = 3.78541;

export default async function FuelingPage({ searchParams }: { searchParams?: Promise<{ vehicleId?: string; from?: string; to?: string }> }) {
  await requirePermission('/fueling');
  const sp = searchParams ? await searchParams : {};
  const vehicleId = sp?.vehicleId;
  const from = sp?.from;
  const to = sp?.to;
  const [logs, vehicles] = await Promise.all([
    vehicleId || from || to ? getFuelingLogsFiltered({ vehicleId, from, to }) : getFuelingLogs(),
    getVehicles(),
  ]);
  const vehicleMap = new Map(vehicles.map(v => [v.id, `${v.plateNumber} (${v.brand} ${v.model})`]));

  return (
    <>
      <PageHeader
        title="Registros de Combustible"
        description="Monitorea el consumo de combustible y los costos de toda tu flota."
        icon={Fuel}
        actions={
          <div className="flex items-center gap-2">
            <FuelingFilters vehicles={vehicles} selectedVehicleId={vehicleId} from={from} to={to} />
            <FuelingExportButtons
              rows={logs.map(l => ({
                plate: l.vehiclePlateNumber || vehicleMap.get(l.vehicleId) || l.vehicleId,
                date: l.fuelingDate,
                mileage: l.mileageAtFueling,
                gallons: Number((l.quantityLiters / LITERS_PER_GALLON).toFixed(2)),
                cpg: Number((l.costPerLiter * LITERS_PER_GALLON).toFixed(2)),
                total: Number(l.totalCost.toFixed(2)),
                efficiency: l.fuelEfficiencyKmPerGallon ?? null,
                station: l.station,
              }))}
            />
            <Link href="/fueling/new">
              <Button className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Nueva Carga
              </Button>
            </Link>
          </div>
        }
      />

      <div className="bg-card p-6 rounded-lg shadow-sm">
        {logs.length === 0 ? (
           <div className="text-center py-12">
            <Fuel className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No se encontraron registros de combustible</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comienza registrando una actividad de carga de combustible para un vehículo.
            </p>
            <div className="mt-6">
              <Link href="/fueling/new">
                <Button className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Registrar Nueva Carga
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Kilometraje</TableHead>
                <TableHead>Galones</TableHead>
                <TableHead>Costo/Galón (C$)</TableHead>
                <TableHead>Costo Total (C$)</TableHead>
                <TableHead>Eficiencia (km/gal)</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.vehiclePlateNumber}</TableCell>
                  <TableCell>{formatDateDDMMYYYY(log.fuelingDate)}</TableCell>
                  <TableCell>{log.mileageAtFueling.toLocaleString()} km</TableCell>
                  <TableCell>{(log.quantityLiters / LITERS_PER_GALLON).toFixed(2)}</TableCell>
                  <TableCell>C${(log.costPerLiter * LITERS_PER_GALLON).toFixed(2)}</TableCell>
                  <TableCell>C${log.totalCost.toFixed(2)}</TableCell>
                  <TableCell>{log.fuelEfficiencyKmPerGallon ? log.fuelEfficiencyKmPerGallon.toFixed(1) : "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link href={`/fueling/${log.id}`}>
                          <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                        </Link>
                        <Link href={`/fueling/${log.id}/edit`}>
                          <DropdownMenuItem>Editar Registro</DropdownMenuItem>
                        </Link>
                        <form action={async () => { "use server"; await deleteFuelingLog(log.id); }}>
                          <ConfirmSubmitMenuItem confirmMessage="¿Eliminar este registro de combustible? Esta acción no se puede deshacer.">
                            Eliminar
                          </ConfirmSubmitMenuItem>
                        </form>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
