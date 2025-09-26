
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Wrench, PlusCircle, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getMaintenanceLogs, getMaintenanceLogsFiltered } from "@/lib/actions/maintenance-actions";
import { requirePermission } from "@/lib/authz";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { formatNumber, formatCurrency } from "@/lib/currency";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MaintenanceExportButtons } from "@/components/maintenance-export";
import { ConfirmSubmitMenuItem } from "@/components/confirm-submit-menu-item";
import { deleteMaintenanceLog } from "@/lib/actions/maintenance-actions";
import MaintenanceFilters from "@/components/maintenance-filters";
import { getVehicles } from "@/lib/actions/vehicle-actions";

export default async function MaintenancePage({ searchParams }: { searchParams?: Promise<{ vehicleId?: string; from?: string; to?: string }> }) {
  await requirePermission('/maintenance');
  const sp = searchParams ? await searchParams : {};
  const vehicleId = sp?.vehicleId;
  const from = sp?.from;
  const to = sp?.to;

  // Default date range to current month when not provided
  const today = new Date();
  const defaultFrom = format(startOfMonth(today), 'yyyy-MM-dd');
  const defaultTo = format(endOfMonth(today), 'yyyy-MM-dd');
  const effFrom = from ?? (to ? undefined : defaultFrom);
  const effTo = to ?? (from ? undefined : defaultTo);

  const [logs, vehicles] = await Promise.all([
    getMaintenanceLogsFiltered({ vehicleId, from: effFrom, to: effTo }),
    getVehicles(),
  ]);

  return (
    <>
      <PageHeader
        title="Registros de Mantenimiento"
        description="Realiza un seguimiento de todo el mantenimiento preventivo y correctivo de tu flota."
        icon={Wrench}
        actions={
           <div className="flex items-center gap-2">
            <MaintenanceFilters vehicles={vehicles} selectedVehicleId={vehicleId} from={effFrom} to={effTo} />
            <MaintenanceExportButtons
              rows={logs.map(l => ({
                vehiclePlateNumber: l.vehiclePlateNumber || "",
                maintenanceType: l.maintenanceType,
                executionDate: l.executionDate,
                mileageAtService: l.mileageAtService,
                cost: l.cost,
                provider: l.provider ?? undefined,
                createdBy: l.createdByUsername || undefined,
                updatedBy: l.updatedByUsername || undefined,
              }))}
            />
            <Link href="/maintenance/new">
              <Button className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Mantenimiento
              </Button>
            </Link>
          </div>
        }
      />

      <div className="bg-card p-6 rounded-lg shadow-sm">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No se encontraron registros de mantenimiento</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comienza registrando una actividad de mantenimiento para un vehículo.
            </p>
            <div className="mt-6">
              <Link href="/maintenance/new">
                <Button className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Registrar Mantenimiento
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <Table className="text-base [&_th]:px-4 [&_th]:py-2 md:[&_th]:py-3 [&_td]:px-4 [&_td]:py-2 md:[&_td]:py-3">
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Kilometraje</TableHead>
                <TableHead>Costo (C$)</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.vehiclePlateNumber}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={log.maintenanceType === "Preventivo" ? "bg-green-600 text-white" : "bg-red-600 text-white"}
                    >
                      {log.maintenanceType}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateDDMMYYYY(log.executionDate)}</TableCell>
                  <TableCell>{formatNumber(log.mileageAtService)} km</TableCell>
                  <TableCell>{formatCurrency(log.cost)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/maintenance/${log.id}`}>Ver Detalles</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/maintenance/${log.id}/edit`}>Editar</Link>
                        </DropdownMenuItem>
                        <form action={async () => { "use server"; await deleteMaintenanceLog(log.id); }}>
                          <ConfirmSubmitMenuItem
                            title="Eliminar registro"
                            confirmLabel="Eliminar"
                            cancelLabel="Cancelar"
                            confirmMessage="¿Eliminar este registro de mantenimiento? Esta acción no se puede deshacer."
                            successToastTitle="Registro eliminado"
                            successToastDescription="El registro de mantenimiento fue eliminado correctamente."
                          >
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
