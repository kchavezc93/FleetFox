
import { requirePermission } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CarFront, PlusCircle, PlayCircle, Trash2 } from "lucide-react";
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
import Image from "next/image";
import { VehicleImage } from "@/components/vehicles/vehicle-image";
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
import { VehiclesExportButtons } from "@/components/vehicles-export";
import { ConfirmSubmitMenuItem } from "@/components/confirm-submit-menu-item";
import VehicleActiveToggleCell from "@/components/vehicles/active-toggle-cell";


export default async function VehiclesPage() {
  await requirePermission('/vehicles');
  const vehicles = await getVehicles(); 

  // Server action compatible con <form action={...}> para toggle inline
  async function toggleVehicleActive(vehicleId: string, nextActive: boolean, _formData: FormData) {
    "use server";
    if (nextActive) {
      await activateVehicle(vehicleId);
    } else {
      await deleteVehicle(vehicleId); // marca Inactivo (soft delete)
    }
    revalidatePath('/vehicles');
  }

  return (
    <>
      <PageHeader
        title="Gestionar Vehículos"
        description="Visualiza, agrega y gestiona tu flota de vehículos."
        icon={CarFront}
        actions={
          <>
            <VehiclesExportButtons
              rows={vehicles.map(v => ({
                plateNumber: v.plateNumber,
                brand: v.brand,
                model: v.model,
                year: v.year,
                fuelType: v.fuelType,
                currentMileage: v.currentMileage,
                status: v.status,
                nextPreventiveMaintenanceDate: v.nextPreventiveMaintenanceDate,
                nextPreventiveMaintenanceMileage: v.nextPreventiveMaintenanceMileage,
              }))}
            />
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
                <TableHead className="w-[80px]">Imagen</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Marca y Modelo</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Kilometraje</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <VehicleImage
                      src={vehicle.imageUrl}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                    />
                  </TableCell>
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <VehicleActiveToggleCell
                        active={vehicle.status === 'Activo'}
                        vehicleId={vehicle.id}
                        action={toggleVehicleActive.bind(null, vehicle.id, vehicle.status !== 'Activo')}
                      />
                    </div>
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
                          }} className="w-full">
                            <DropdownMenuItem asChild>
                              <button type="submit" className="w-full text-left">
                                <PlayCircle className="mr-2 h-4 w-4" /> {vehicle.status === "Inactivo" ? "Activar Vehículo" : "Marcar como Activo"}
                              </button>
                            </DropdownMenuItem>
                          </form>
                        ) : (
                          <form action={async () => {
                            "use server";
                            await deleteVehicle(vehicle.id);
                            revalidatePath("/vehicles");
                          }} className="w-full">
                            <ConfirmSubmitMenuItem confirmMessage="¿Marcar este vehículo como Inactivo?">
                              <span className="flex items-center">
                                <Trash2 className="mr-2 h-4 w-4" /> Marcar como Inactivo
                              </span>
                            </ConfirmSubmitMenuItem>
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
