
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, FileDown, Printer } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";
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
import { format } from "date-fns";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import MaintenanceFilters from "@/components/maintenance-filters";
import { useSearchParams } from "next/navigation";

interface EnrichedMaintenanceLog extends MaintenanceLog {
  vehicleBrand?: string;
  vehicleModel?: string;
}

export default function MaintenanceHistoryReportPage() {
  const searchParams = useSearchParams();
  const selectedVehicleId = searchParams.get('vehicleId') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const [enrichedLogs, setEnrichedLogs] = useState<EnrichedMaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedVehicleId) params.set('vehicleId', selectedVehicleId);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        const resLogs = await fetch(`/api/maintenance/logs${qs ? `?${qs}` : ''}`, { cache: "no-store" });
        if (!resLogs.ok) throw new Error(`Error cargando logs: ${resLogs.status}`);
        const maintenanceLogsData: MaintenanceLog[] = await resLogs.json();
        const resVehicles = await fetch("/api/vehicles/list", { cache: "no-store" });
        if (!resVehicles.ok) throw new Error(`Error cargando vehículos: ${resVehicles.status}`);
        const vehiclesData: Vehicle[] = await resVehicles.json();
        setVehicles(vehiclesData);

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
  }, [selectedVehicleId, from, to]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (enrichedLogs.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Fecha Ejecución", "Tipo", "Kilometraje", "Costo (C$)", "Proveedor"];
    const csvRows = [
      headers.join(','),
      ...enrichedLogs.map(log => [
        log.vehiclePlateNumber,
        `${log.vehicleBrand || ''} ${log.vehicleModel || ''}`.trim(),
  formatDateDDMMYYYY(log.executionDate),
        log.maintenanceType,
        log.mileageAtService.toLocaleString(),
        `C$${log.cost.toFixed(2)}`,
        log.provider
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_historial_mantenimiento.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXLSX = async () => {
    if (enrichedLogs.length === 0) return;
    const rows = enrichedLogs.map(log => ({
      plate: log.vehiclePlateNumber,
      brandModel: `${log.vehicleBrand || ''} ${log.vehicleModel || ''}`.trim(),
      execDate: format(new Date(log.executionDate + "T00:00:00"), "yyyy-MM-dd"),
      type: log.maintenanceType,
      mileage: log.mileageAtService,
      cost: Number(log.cost.toFixed(2)),
      provider: log.provider,
    }));
    await exportToXLSX({
      rows,
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "brandModel", header: "Marca y Modelo", width: 28 },
        { key: "execDate", header: "Fecha Ejecución", format: "date" },
        { key: "type", header: "Tipo" },
        { key: "mileage", header: "Kilometraje", format: "integer" },
        { key: "cost", header: "Costo (C$)", format: "currency", numFmt: "[$C$] #,##0.00" },
        { key: "provider", header: "Proveedor" },
      ],
    }, "informe_historial_mantenimiento", "Historial");
  };

  return (
    <>
      <PageHeader
        title="Informe de Historial de Mantenimiento"
        description="Consulta el historial detallado de todos los servicios de mantenimiento realizados."
        icon={History}
        actions={
          <div className="page-header-actions flex items-center gap-2">
            <MaintenanceFilters vehicles={vehicles} selectedVehicleId={selectedVehicleId ?? undefined} from={from ?? undefined} to={to ?? undefined} />
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV} disabled={enrichedLogs.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={enrichedLogs.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
              </Button>
            </div>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">Historial Completo de Mantenimientos</CardTitle>
          <CardDescription>
            Lista de todos los registros de mantenimiento en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : enrichedLogs.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de mantenimiento disponibles para generar el informe. Verifique la implementación de la base de datos.</p>
          ) : (
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Vehículo (Matrícula)</TableHead>
                  <TableHead className="font-semibold">Marca y Modelo</TableHead>
                  <TableHead className="font-semibold">Fecha Ejecución</TableHead>
                  <TableHead className="font-semibold">Tipo</TableHead>
                  <TableHead className="text-right font-semibold">Kilometraje</TableHead>
                  <TableHead className="text-right font-semibold">Costo (C$)</TableHead>
                  <TableHead className="font-semibold">Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.vehiclePlateNumber}</TableCell>
                    <TableCell>{log.vehicleBrand} {log.vehicleModel}</TableCell>
                    <TableCell>{formatDateDDMMYYYY(log.executionDate)}</TableCell>
                    <TableCell>
                      <Badge variant={log.maintenanceType === "Preventivo" ? "default" : "secondary"} 
                             className={log.maintenanceType === "Preventivo" ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}>
                        {log.maintenanceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.mileageAtService.toLocaleString()} km</TableCell>
                    <TableCell className="text-right font-medium">C${log.cost.toFixed(2)}</TableCell>
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
