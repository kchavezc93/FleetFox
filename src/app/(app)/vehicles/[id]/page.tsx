
import { getVehicleById, deleteVehicle, activateVehicle } from "@/lib/actions/vehicle-actions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CarFront, CalendarDays, Gauge, Tag, Fuel, ShieldCheck, AlertTriangle, Edit, Trash2, PlayCircle, PenToolIcon } from "lucide-react"; // Changed Tool to PenToolIcon
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
  isBadge?: boolean;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  badgeClassName?: string;
}

function DetailItem({ icon: Icon, label, value, isBadge, badgeVariant, badgeClassName }: DetailItemProps) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start space-x-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-1" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {isBadge ? (
          <Badge variant={badgeVariant} className={badgeClassName}>{value}</Badge>
        ) : (
          <p className="text-base text-foreground">{String(value)}</p>
        )}
      </div>
    </div>
  );
}

export default async function VehicleDetailsPage({ params }: { params: { id: string } }) {
  const vehicle = await getVehicleById(params.id);

  if (!vehicle) {
    notFound();
  }
  
  const handleStatusChangeAction = async () => {
    "use server";
    if (vehicle.status === "Activo" || vehicle.status === "En Taller") {
      // If active or in workshop, action is to mark as inactive
      await deleteVehicle(vehicle.id);
    } else if (vehicle.status === "Inactivo") {
      // If inactive, action is to activate
      await activateVehicle(vehicle.id);
    }
    // For "En Taller" to "Activo", it's also activateVehicle
    // The logic for "En Taller" -> "Activo" is handled by the button text and action choice below.
    redirect(`/vehicles/${vehicle.id}`); // Redirect to refresh details page
  };
  
  const handleActivateAction = async () => {
    "use server";
    await activateVehicle(vehicle.id);
    redirect(`/vehicles/${vehicle.id}`);
  }

  const handleDeactivateAction = async () => {
    "use server";
    await deleteVehicle(vehicle.id); // deleteVehicle marks as Inactive
    redirect(`/vehicles/${vehicle.id}`);
  }


  let statusButtonAction: React.ReactNode;
  if (vehicle.status === "Inactivo") {
    statusButtonAction = (
      <form action={handleActivateAction}>
        <Button variant="default" type="submit" className="bg-primary hover:bg-primary/90">
          <PlayCircle className="mr-2 h-4 w-4" /> Activar Vehículo
        </Button>
      </form>
    );
  } else if (vehicle.status === "En Taller") {
    statusButtonAction = (
      <form action={handleActivateAction}>
        <Button variant="default" type="submit" className="bg-primary hover:bg-primary/90">
          <PlayCircle className="mr-2 h-4 w-4" /> Marcar como Activo
        </Button>
      </form>
    );
  } else { // Activo
    statusButtonAction = (
      <form action={handleDeactivateAction}>
        <Button variant="destructive" type="submit">
          <Trash2 className="mr-2 h-4 w-4" /> Marcar como Inactivo
        </Button>
      </form>
    );
  }


  return (
    <>
      <PageHeader
        title={`Detalles del Vehículo: ${vehicle.plateNumber}`}
        description={`Información completa para ${vehicle.brand} ${vehicle.model} (${vehicle.year}).`}
        icon={CarFront}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/vehicles/${vehicle.id}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Button>
            </Link>
            {statusButtonAction}
            <Link href="/vehicles">
              <Button variant="outline">Volver a la Lista</Button>
            </Link>
          </div>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Información del Vehículo</CardTitle>
          <CardDescription>Detalles completos del vehículo seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="mb-6">
            <Image
              src={vehicle.imageUrl || "https://placehold.co/600x400.png"}
              alt={`${vehicle.brand} ${vehicle.model}`}
              width={600}
              height={400}
              className="rounded-md object-cover mx-auto shadow-md"
              data-ai-hint="vehicle car"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            <DetailItem icon={Tag} label="Matrícula" value={vehicle.plateNumber} />
            <DetailItem icon={Tag} label="VIN" value={vehicle.vin} />
            <DetailItem icon={Tag} label="Marca" value={vehicle.brand} />
            <DetailItem icon={Tag} label="Modelo" value={vehicle.model} />
            <DetailItem icon={CalendarDays} label="Año" value={vehicle.year} />
            <DetailItem icon={Fuel} label="Tipo de Combustible" value={vehicle.fuelType} />
            <DetailItem icon={Gauge} label="Kilometraje Actual" value={`${vehicle.currentMileage.toLocaleString()} km`} />
            
            <DetailItem 
              icon={
                vehicle.status === "Activo" ? ShieldCheck : 
                vehicle.status === "En Taller" ? PenToolIcon : // Using PenToolIcon for "En Taller"
                Trash2 
              } 
              label="Estado" 
              value={vehicle.status} 
              isBadge
              badgeClassName={
                vehicle.status === "Activo" ? "bg-green-600 text-white" : 
                vehicle.status === "En Taller" ? "bg-yellow-500 text-black" :
                "bg-red-600 text-white"
              }
            />
            
            <DetailItem icon={Gauge} label="Próx. Mantenimiento (Kilometraje)" value={`${vehicle.nextPreventiveMaintenanceMileage.toLocaleString()} km`} />
            <DetailItem icon={CalendarDays} label="Próx. Mantenimiento (Fecha)" value={format(new Date(vehicle.nextPreventiveMaintenanceDate + "T00:00:00"), "PPP", { locale: es })} />
            
            <DetailItem icon={CalendarDays} label="Fecha de Creación" value={format(new Date(vehicle.createdAt), "PPPp", { locale: es })} />
            <DetailItem icon={CalendarDays} label="Última Actualización" value={format(new Date(vehicle.updatedAt), "PPPp", { locale: es })} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
