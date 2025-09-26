
import { getMaintenanceLogById, deleteMaintenanceLog } from "@/lib/actions/maintenance-actions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench, CalendarDays,Gauge, Tag, Users, Construction, DollarSign, FileText, Edit, Trash2, Paperclip, FileDown as FileDownIcon, User as UserIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import Image from "next/image"; // Next.js Image component
import { formatNumber, formatCurrency } from "@/lib/currency";

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

// export default async function MaintenanceLogDetailsPage({ params }: { params: { id: string } }) {
//   const log = await getMaintenanceLogById(params.id);

//   if (!log) {
//     notFound();
//   }
  
//   const handleDeleteAction = async () => {
//     "use server";
//     await deleteMaintenanceLog(log.id);
//   };

  export default async function MaintenanceLogDetailsPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;
    const log = await getMaintenanceLogById(id);

    if (!log) {
      notFound();
    }

    const handleDeleteAction = async () => {
      "use server";
      await deleteMaintenanceLog(id);
    };

  return (
    <>
      <PageHeader
        title={`Detalles de Mantenimiento: ${log.vehiclePlateNumber}`}
  description={`Registro de mantenimiento del ${formatDateDDMMYYYY(log.executionDate)}.`}
        icon={Wrench}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/maintenance/${log.id}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Button>
            </Link>
            <form action={handleDeleteAction}>
              <ConfirmSubmitButton variant="destructive" confirmMessage="¿Eliminar este registro de mantenimiento?">
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </ConfirmSubmitButton>
            </form>
            <Link href="/maintenance">
              <Button variant="outline">Volver a la Lista</Button>
            </Link>
          </div>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Información del Registro de Mantenimiento</CardTitle>
          <CardDescription>Detalles completos de la actividad de mantenimiento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DetailItem icon={Tag} label="ID de Registro" value={log.id} />
            <DetailItem icon={Tag} label="ID de Vehículo" value={log.vehicleId} />
            <DetailItem icon={Tag} label="Matrícula del Vehículo" value={log.vehiclePlateNumber} />
            <DetailItem 
              icon={Construction} 
              label="Tipo de Mantenimiento" 
              value={log.maintenanceType} 
              isBadge 
              badgeClassName={log.maintenanceType === "Preventivo" ? "bg-green-600 text-white" : "bg-red-600 text-white"}
            />
            <DetailItem icon={CalendarDays} label="Fecha de Ejecución" value={formatDateDDMMYYYY(log.executionDate)} />
            <DetailItem icon={Gauge} label="Kilometraje en Servicio" value={`${formatNumber(log.mileageAtService)} km`} />
            <DetailItem icon={DollarSign} label="Costo" value={formatCurrency(log.cost)} />
            {log.provider && <DetailItem icon={Users} label="Proveedor" value={log.provider} />}
            {log.nextMaintenanceDateScheduled && <DetailItem icon={CalendarDays} label="Próximo Mantenimiento (Fecha)" value={formatDateDDMMYYYY(log.nextMaintenanceDateScheduled)} />}
            {log.nextMaintenanceMileageScheduled && <DetailItem icon={Gauge} label="Próximo Mantenimiento (Kilometraje)" value={`${formatNumber(log.nextMaintenanceMileageScheduled)} km`} />}
            <DetailItem icon={CalendarDays} label="Fecha de Creación del Registro" value={format(new Date(log.createdAt), "PPPp", { locale: es })} />
            {log.createdByUsername || log.createdByUserId ? (
              <DetailItem icon={UserIcon} label="Creado por" value={log.createdByUsername ?? `Usuario #${log.createdByUserId}`} />
            ) : null}
            {log.updatedAt ? (
              <DetailItem icon={CalendarDays} label="Última Actualización del Registro" value={format(new Date(log.updatedAt), "PPPp", { locale: es })} />
            ) : null}
            {log.updatedByUsername || log.updatedByUserId ? (
              <DetailItem icon={UserIcon} label="Actualizado por" value={log.updatedByUsername ?? `Usuario #${log.updatedByUserId}`} />
            ) : null}
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="text-md font-semibold text-primary mb-2 flex items-center">
                <FileText className="h-5 w-5 mr-2"/>
                Actividades Realizadas
            </h4>
            <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-md">{log.activitiesPerformed}</p>
          </div>

          {log.attachments && log.attachments.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-md font-semibold text-primary mb-3 flex items-center">
                <Paperclip className="h-5 w-5 mr-2"/>
                Archivos Adjuntos ({log.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {log.attachments.map((att) => {
                  const isImageFile = att.fileType && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(att.fileType);
                  return (
                    <Card key={att.id} className="overflow-hidden">
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm truncate">{att.fileName}</CardTitle>
                        <CardDescription className="text-xs">{att.fileType}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-3">
                        {isImageFile ? (
                          <Image 
                            src={att.fileContent} 
                            alt={`Adjunto: ${att.fileName}`}
                            width={300} 
                            height={200} 
                            className="rounded-md object-contain border shadow-sm mx-auto max-h-48"
                            data-ai-hint="document image"
                          />
                        ) : (
                           <div className="flex flex-col items-center justify-center h-32 bg-muted/30 rounded-md p-4 text-center">
                            <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Vista previa no disponible</p>
                           </div>
                        )}
                         <a 
                            href={att.fileContent} 
                            download={att.fileName}
                            className="mt-3 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 py-1.5 w-full"
                          >
                            <FileDownIcon className="mr-2 h-4 w-4" />
                            Descargar
                          </a>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
