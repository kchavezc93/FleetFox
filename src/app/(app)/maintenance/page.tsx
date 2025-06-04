
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Wrench, PlusCircle, FileDown, MoreHorizontal } from "lucide-react";
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
//import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getMaintenanceLogs, exportMaintenanceLogsToExcel } from "@/lib/actions/maintenance-actions"; // Asegúrate de importar exportMaintenanceLogsToExcel
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react"; 

// Si el componente es Client Component y fetchea datos en el cliente (ejemplo alternativo):
export default function MaintenancePage() {
  const [logs, setLogs] = useState<any[]>([]); // Ajusta el tipo según tu MaintenanceLog
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on client mount (adjust if you prefer server fetching)
  useEffect(() => {
    async function fetchLogs() {
      setIsLoading(true);
      setError(null);
      try {
        // Esta llamada DEBE funcionar y obtener datos reales desde tu BD implementada
        const fetchedLogs = await getMaintenanceLogs();
        if (Array.isArray(fetchedLogs)) {
           setLogs(fetchedLogs);
        } else {
            // Manejar caso donde getMaintenanceLogs devuelva un objeto de error si no está implementado
            console.error("getMaintenanceLogs did not return an array:", fetchedLogs);
            setError("Error al cargar registros de mantenimiento.");
            setLogs([]); // Asegura que logs sea un array vacío en caso de error
        }
      } catch (err) {
        console.error("Error fetching maintenance logs in client:", err);
        setError("Error al cargar registros de mantenimiento.");
        setLogs([]); // Asegura que logs sea un array vacío en caso de error
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []); // Empty dependency array means this runs once on mount


  const handleExport = async () => {
    console.log("Attempting to export Excel...");
    // Llama a la Acción del Servidor
    const result = await exportMaintenanceLogsToExcel();

    if (result.success && result.data) {
      console.log("Export action successful. Handling download...");
      try {
          // Crear un Blob a partir de los datos (Array<number>)
          const blob = new Blob([new Uint8Array(result.data as number[])], { type: result.contentType });

          // Crear una URL de objeto para el Blob
          const url = URL.createObjectURL(blob);

          // Crear un enlace de descarga
          const a = document.createElement('a');
          a.href = url;
          a.download = 'registros_mantenimiento.xlsx'; // Nombre del archivo

          // Simular un clic para iniciar la descarga
          document.body.appendChild(a);
          a.click();

          // Limpiar
          document.body.removeChild(a);
          URL.revokeObjectURL(url); // Liberar la URL del objeto

          console.log("Download initiated.");
      } catch (downloadError) {
          console.error("Error handling file download:", downloadError);
          // Mostrar error de descarga al usuario si tienes un toast
      }

    } else {
      console.error("Export action failed:", result.message);
      // Mostrar mensaje de error al usuario si tienes un toast
      alert(result.message || "Error desconocido al exportar.");
    }
  };


 return (
   <>
     <PageHeader
       title="Registros de Mantenimiento"
       description="Realiza un seguimiento de todo el mantenimiento preventivo y correctivo de tu flota."
       icon={Wrench}
       actions={
          <>
           {/* Modificar este botón para usar el onClick que llama a handleExport */}
           <Button variant="outline" onClick={handleExport} disabled={isLoading}> {/* Deshabilita durante la carga si fetchas en cliente */}
             <FileDown className="mr-2 h-4 w-4" />
             Exportar Excel
           </Button>
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
       {isLoading ? (
           <div className="text-center py-12">Cargando registros...</div>
       ) : error ? (
            <div className="text-center py-12 text-red-500">Error: {error}</div>
       ) : logs.length === 0 ? (
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
                 <TableCell>{format(new Date(log.executionDate), "PP", { locale: es })}</TableCell>
                 <TableCell>{log.mileageAtService?.toLocaleString() || 'N/A'} km</TableCell> {/* Añadir manejo de N/A por si acaso */}
                 <TableCell>C${log.cost?.toFixed(2) || '0.00'}</TableCell> {/* Añadir manejo de N/A/formato */}
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
                        {/* Puedes añadir una opción de eliminar aquí si implementas deleteMaintenanceLog */}
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