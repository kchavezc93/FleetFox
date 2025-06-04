
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, FileDown, Filter, Printer } from "lucide-react";
import type { Vehicle } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { format, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const DAYS_THRESHOLD_FOR_UPCOMING = 30; // Mantenimiento en los próximos 30 días
const MILEAGE_THRESHOLD_FOR_UPCOMING = 2000; // Mantenimiento en los próximos 2000 km

interface UpcomingMaintenanceVehicle extends Vehicle {
  daysToNextMaintenance?: number;
  kmToNextMaintenance?: number;
  reason: "Fecha" | "Kilometraje" | "Ambos";
}

export default function UpcomingMaintenanceReportPage() {
  const [upcomingVehicles, setUpcomingVehicles] = useState<UpcomingMaintenanceVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const vehiclesData = await getVehicles();
        const today = new Date();

        const processedVehicles = vehiclesData
          .map(vehicle => {
            let isUpcomingByDate = false;
            let isUpcomingByMileage = false;
            let daysToNext: number | undefined;
            let kmToNext: number | undefined;

            if (vehicle.nextPreventiveMaintenanceDate) {
              const nextMaintDate = new Date(vehicle.nextPreventiveMaintenanceDate + "T00:00:00");
              daysToNext = differenceInDays(nextMaintDate, today);
              if (daysToNext >= 0 && daysToNext <= DAYS_THRESHOLD_FOR_UPCOMING) {
                isUpcomingByDate = true;
              }
            }

            if (vehicle.nextPreventiveMaintenanceMileage && vehicle.currentMileage) {
              kmToNext = vehicle.nextPreventiveMaintenanceMileage - vehicle.currentMileage;
              if (kmToNext >= 0 && kmToNext <= MILEAGE_THRESHOLD_FOR_UPCOMING) {
                isUpcomingByMileage = true;
              }
            }
            
            let reason: "Fecha" | "Kilometraje" | "Ambos" | null = null;
            if (isUpcomingByDate && isUpcomingByMileage) reason = "Ambos";
            else if (isUpcomingByDate) reason = "Fecha";
            else if (isUpcomingByMileage) reason = "Kilometraje";

            if (reason) {
              return {
                ...vehicle,
                daysToNextMaintenance: daysToNext,
                kmToNextMaintenance: kmToNext,
                reason,
              };
            }
            return null;
          })
          .filter(Boolean) as UpcomingMaintenanceVehicle[];
        
        // Sort by urgency (fewer days/km remaining first)
        processedVehicles.sort((a, b) => {
            const aUrgency = Math.min(a.daysToNextMaintenance ?? Infinity, (a.kmToNextMaintenance ?? Infinity) / 50); // Arbitrary factor for km
            const bUrgency = Math.min(b.daysToNextMaintenance ?? Infinity, (b.kmToNextMaintenance ?? Infinity) / 50);
            return aUrgency - bUrgency;
        });

        setUpcomingVehicles(processedVehicles);
      } catch (error) {
        console.error("Error loading upcoming maintenance report data:", error);
        setUpcomingVehicles([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadReportData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (upcomingVehicles.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Próx. Mantenimiento (Fecha)", "Próx. Mantenimiento (Km)", "Alerta Por", "Días Restantes", "Km Restantes"];
    const reportRows = [
      headers.join('\t'), // Use tab as separator
      ...upcomingVehicles.map(v => [
        v.plateNumber,
        `${v.brand} ${v.model}`,
        format(new Date(v.nextPreventiveMaintenanceDate + "T00:00:00"), "PP", { locale: es }),
        v.nextPreventiveMaintenanceMileage.toLocaleString(),
        v.reason,
        v.daysToNextMaintenance ?? 'N/A',
        v.kmToNextMaintenance?.toLocaleString() ?? 'N/A'
      ].join('\t'))
    ];
    const reportString = reportRows.join('\n');
    const blob = new Blob([reportString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_mantenimiento_proximo.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <PageHeader
        title="Informe de Mantenimiento Próximo"
        description={`Vehículos que requieren mantenimiento preventivo en los próximos ${DAYS_THRESHOLD_FOR_UPCOMING} días o ${MILEAGE_THRESHOLD_FOR_UPCOMING} km.`}
        icon={CalendarClock}
        actions={
          <div className="page-header-actions flex items-center gap-2">
            {/* <Button variant="outline" disabled> <Filter className="mr-2 h-4 w-4" /> Filtros </Button> */}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportExcel} disabled={upcomingVehicles.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Exportar Informe (Excel)
            </Button>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Vehículos con Mantenimiento Próximo</CardTitle>
          <CardDescription>
            Lista de vehículos cuyo mantenimiento preventivo está programado o se acerca. Los datos se mostrarán una vez implementada la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : upcomingVehicles.length === 0 ? (
            <p className="text-muted-foreground">No hay vehículos con mantenimiento próximo o no hay datos disponibles. Verifique la implementación de la base de datos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo (Matrícula)</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead>Próx. Mantenimiento (Fecha)</TableHead>
                  <TableHead>Próx. Mantenimiento (Km)</TableHead>
                  <TableHead>Alerta Por</TableHead>
                  <TableHead className="text-right">Días Restantes</TableHead>
                  <TableHead className="text-right">Km Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingVehicles.map(vehicle => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                    <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                    <TableCell>{format(new Date(vehicle.nextPreventiveMaintenanceDate + "T00:00:00"), "PP", { locale: es })}</TableCell>
                    <TableCell>{vehicle.nextPreventiveMaintenanceMileage.toLocaleString()} km</TableCell>
                    <TableCell>
                        <Badge 
                            variant={vehicle.reason === "Fecha" ? "default" : vehicle.reason === "Kilometraje" ? "secondary" : "destructive"}
                            className={vehicle.reason === "Ambos" ? "bg-red-500 text-white" : ""}
                        >
                            {vehicle.reason}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">{vehicle.daysToNextMaintenance ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{vehicle.kmToNextMaintenance?.toLocaleString() ?? 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
