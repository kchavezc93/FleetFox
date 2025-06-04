
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CarFront, PlusCircle, FileDown, PlayCircle, Trash2, Tool } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { getVehicles, deleteVehicle, activateVehicle } from "@/lib/actions/vehicle-actions";
import { revalidatePath } from "next/cache";


export default async function VehiclesPage() {
  const vehicles = await getVehicles(); 

  return (
    <>
      <PageHeader
        title="Gestionar Vehículos"
        description="Visualiza, agrega y gestiona tu flota de vehículos."
        icon={CarFront}
        actions={
          <>
            <Button variant="outline" disabled>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Link href="/vehicles/new">
              <Button className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Vehículo
              </Button>
            </Link>
          </>
        }
      />

      <div className="bg-card p-6 rounded-lg shadow-sm">
        {vehicles.length === 0 ? (
          <div className="text-center py-12">
            <CarFront className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No se encontraron vehículos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comienza agregando tu primer vehículo.
            </p>
            <div className="mt-6">
              <Link href="/vehicles/new">
                <Button className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Agregar Vehículo
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Marca y Modelo</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Millaje</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                  <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                  <TableCell>{vehicle.year}</TableCell>
                  <TableCell>{vehicle.currentMileage.toLocaleString()} km</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        vehicle.status === "Activo"
                          ? "default"
                          : vehicle.status === "En Taller"
                          ? "secondary" 
                          : "destructive"
                      }
                      className={
                        vehicle.status === "Activo" ? "bg-green-600 text-white" : 
                        vehicle.status === "En Taller" ? "bg-yellow-500 text-black" :
                        "bg-red-600 text-white"
                      }
                    >
                      {vehicle.status}
                    </Badge>
                  </TableCell>
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
                          <Link href={`/vehicles/${vehicle.id}/edit`}>Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/vehicles/${vehicle.id}`}>Ver Detalles</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {vehicle.status === "Inactivo" || vehicle.status === "En Taller" ? (
                           <form action={async () => {
                              "use server";
                              await activateVehicle(vehicle.id);
                              revalidatePath("/vehicles"); 
                            }}
                            className="w-full"
                          >
                            <DropdownMenuItem asChild>
                               <button type="submit" className="text-primary focus:text-primary/90 focus:bg-primary/10 w-full text-left relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                                <PlayCircle className="mr-2 h-4 w-4" /> 
                                {vehicle.status === "Inactivo" ? "Activar Vehículo" : "Marcar como Activo"}
                              </button>
                            </DropdownMenuItem>
                          </form>
                        ) : ( // Status === "Activo"
                          <form action={async () => {
                              "use server";
                              await deleteVehicle(vehicle.id); // This action marks as Inactive
                              revalidatePath("/vehicles"); 
                            }}
                            className="w-full"
                          >
                            <DropdownMenuItem asChild>
                               <button type="submit" className="text-destructive focus:text-destructive focus:bg-destructive/10 w-full text-left relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                                <Trash2 className="mr-2 h-4 w-4" /> Marcar como Inactivo
                              </button>
                            </DropdownMenuItem>
                          </form>
                        )}
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
