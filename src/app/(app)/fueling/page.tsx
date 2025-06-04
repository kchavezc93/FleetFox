
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Fuel, PlusCircle, FileDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFuelingLogs } from "@/lib/actions/fueling-actions";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LITERS_PER_GALLON = 3.78541;

export default async function FuelingPage() {
  const logs = await getFuelingLogs();

  return (
    <>
      <PageHeader
        title="Registros de Combustible"
        description="Monitorea el consumo de combustible y los costos de toda tu flota."
        icon={Fuel}
        actions={
          <>
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Link href="/fueling/new">
              <Button className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Nueva Carga
              </Button>
            </Link>
          </>
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
                <TableHead>Millaje</TableHead>
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
                  <TableCell>{format(new Date(log.fuelingDate), "PP")}</TableCell>
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
                        <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
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
