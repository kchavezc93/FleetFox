
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
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { requirePermission } from "@/lib/authz";
import { format } from "date-fns";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MaintenanceExportButtons } from "@/components/maintenance-export";

export default async function MaintenancePage() {
  await requirePermission('/maintenance');
  const logs = await getMaintenanceLogs();

  return (
    <>
      <PageHeader
        title="Registros de Mantenimiento"
        description="Realiza un seguimiento de todo el mantenimiento preventivo y correctivo de tu flota."
        icon={Wrench}
        actions={
           <>
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
          </>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Millaje</TableHead>
                <TableHead>Costo (C$)</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.vehiclePlateNumber}</TableCell>
                  <TableCell>
                    <Badge variant={log.maintenanceType === "Preventivo" ? "default" : "secondary"} 
                           className={log.maintenanceType === "Preventivo" ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}>
                      {log.maintenanceType}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateDDMMYYYY(log.executionDate)}</TableCell>
                  <TableCell>{log.mileageAtService.toLocaleString()} km</TableCell>
                  <TableCell>C${log.cost.toFixed(2)}</TableCell>
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
                        {/* <DropdownMenuItem>Editar Registro</DropdownMenuItem> */}
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
