
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import type { MaintenanceLog, Vehicle } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface EnrichedMaintenanceLog extends MaintenanceLog {
  vehicleBrand?: string;
  vehicleModel?: string;
}

export default function MaintenanceHistoryReportPage() {
  const [enrichedLogs, setEnrichedLogs] = useState<EnrichedMaintenanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const maintenanceLogsData = await getMaintenanceLogs();
        const vehiclesData = await getVehicles();

        if (maintenanceLogsData.length === 0) {
          setEnrichedLogs([]);
          setIsLoading(false);
          return;
        }

        const vehiclesMap = new Map(vehiclesData.map(v => [v.id, v]));

        const processedLogs = maintenanceLogsData.map(log => ({
          ...log,
          vehicleBrand: vehiclesMap.get(log.vehicleId)?.brand,
          vehicleModel: vehiclesMap.get(log.vehicleId)?.model,
        })).sort((a, b) => {
          // Sort by vehicle plate, then by execution date descending
          if (a.vehiclePlateNumber && b.vehiclePlateNumber && a.vehiclePlateNumber < b.vehiclePlateNumber) return -1;
          if (a.vehiclePlateNumber && b.vehiclePlateNumber && a.vehiclePlateNumber > b.vehiclePlateNumber) return 1;
          return new Date(b.executionDate).getTime() - new Date(a.executionDate).getTime();
        });
        
        setEnrichedLogs(processedLogs);
      } catch (error) {
        console.error("Error loading maintenance history report data:", error);
        setEnrichedLogs([]);
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
    if (enrichedLogs.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Fecha Ejecución", "Tipo", "Kilometraje", "Costo (C$)", "Proveedor"];
    const reportRows = [
      headers.join('\t'), // Use tab as separator
      ...enrichedLogs.map(log => [
        log.vehiclePlateNumber,
        `${log.vehicleBrand || ''} ${log.vehicleModel || ''}`.trim(),
        format(new Date(log.executionDate + "T00:00:00"), "PP", { locale: es }),
        log.maintenanceType,
        log.mileageAtService.toLocaleString(),
        `C$${log.cost.toFixed(2)}`,
        log.provider
      ].join('\t'))
    ];
    const reportString = reportRows.join('\n');
    const blob = new Blob([reportString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_historial_mantenimiento.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <PageHeader
        title="Informe de Historial de Mantenimiento"
        description="Consulta el historial detallado de todos los servicios de mantenimiento realizados."
        icon={History}
        actions={
          <div className="page-header-actions flex items-center gap-2">
            <Button variant="outline" disabled>
              <CalendarDays className="mr-2 h-4 w-4" /> Rango de Fechas
            </Button>
            <Button variant="outline" disabled>
              <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportExcel} disabled={enrichedLogs.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Exportar Informe (Excel)
            </Button>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Historial Completo de Mantenimientos</CardTitle>
          <CardDescription>
            Lista de todos los registros de mantenimiento. Los datos se mostrarán una vez implementada la conexión y lógica de base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : enrichedLogs.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de mantenimiento disponibles para generar el informe. Verifique la implementación de la base de datos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo (Matrícula)</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead>Fecha Ejecución</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Costo (C$)</TableHead>
                  <TableHead>Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.vehiclePlateNumber}</TableCell>
                    <TableCell>{log.vehicleBrand} {log.vehicleModel}</TableCell>
                    <TableCell>{format(new Date(log.executionDate + "T00:00:00"), "PP", { locale: es })}</TableCell>
                    <TableCell>
                      <Badge variant={log.maintenanceType === "Preventivo" ? "default" : "secondary"} 
                             className={log.maintenanceType === "Preventivo" ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}>
                        {log.maintenanceType}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.mileageAtService.toLocaleString()} km</TableCell>
                    <TableCell className="text-right">C${log.cost.toFixed(2)}</TableCell>
                    <TableCell>{log.provider}</TableCell>
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
