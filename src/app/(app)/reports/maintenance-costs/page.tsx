
"use client"; // This page will need client-side interaction for filters and potentially charts

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import type { MaintenanceLog, Vehicle } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import { useState, useEffect } from "react";
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";


type VehicleMaintenanceSummary = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  totalPreventiveCost: number;
  totalCorrectiveCost: number;
  totalCost: number;
  logCount: number;
};

export default function MaintenanceCostsReportPage() {
  const [summaries, setSummaries] = useState<VehicleMaintenanceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const maintenanceLogsData = await getMaintenanceLogs();
        const vehiclesData = await getVehicles();

        if (!vehiclesData || vehiclesData.length === 0) {
          setSummaries([]);
          setIsLoading(false);
          return;
        }
        
        const processedSummaries: VehicleMaintenanceSummary[] = vehiclesData.map(vehicle => {
          const logsForVehicle = maintenanceLogsData.filter(log => log.vehicleId === vehicle.id);
          const totalPreventiveCost = logsForVehicle
            .filter(log => log.maintenanceType === "Preventivo")
            .reduce((sum, log) => sum + log.cost, 0);
          const totalCorrectiveCost = logsForVehicle
            .filter(log => log.maintenanceType === "Correctivo")
            .reduce((sum, log) => sum + log.cost, 0);
          const totalCost = totalPreventiveCost + totalCorrectiveCost;
          
          return {
            vehicleId: vehicle.id,
            plateNumber: vehicle.plateNumber,
            brandModel: `${vehicle.brand} ${vehicle.model}`,
            totalPreventiveCost,
            totalCorrectiveCost,
            totalCost,
            logCount: logsForVehicle.length
          };
        }).filter(summary => summary.logCount > 0);

        setSummaries(processedSummaries);
      } catch (error) {
        console.error("Error loading maintenance costs report data:", error);
        setSummaries([]);
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
    if (summaries.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Costo Preventivo (C$)", "Costo Correctivo (C$)", "Costo Total (C$)", "Núm. Registros"];
    const reportRows = [
      headers.join('\t'), // Use tab as separator
      ...summaries.map(s => [
        s.plateNumber,
        s.brandModel,
        `C$${s.totalPreventiveCost.toFixed(2)}`,
        `C$${s.totalCorrectiveCost.toFixed(2)}`,
        `C$${s.totalCost.toFixed(2)}`,
        s.logCount
      ].join('\t'))
    ];
    const reportString = reportRows.join('\n');
    const blob = new Blob([reportString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_costos_mantenimiento.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <PageHeader
        title="Informe de Costos de Mantenimiento"
        description="Analiza los gastos de mantenimiento por vehículo y tipo."
        icon={Wrench}
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
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportExcel} disabled={summaries.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Exportar Informe (Excel)
            </Button>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Resumen por Vehículo</CardTitle>
          <CardDescription>Costos totales de mantenimiento por vehículo. Los datos se mostrarán una vez implementada la conexión y lógica de base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : summaries.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de mantenimiento disponibles para generar el informe. Verifique la implementación de la conexión con la base de datos y los registros existentes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo (Matrícula)</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead className="text-right">Costo Preventivo (C$)</TableHead>
                  <TableHead className="text-right">Costo Correctivo (C$)</TableHead>
                  <TableHead className="text-right">Costo Total (C$)</TableHead>
                  <TableHead className="text-right">Núm. Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map(summary => (
                  <TableRow key={summary.vehicleId}>
                    <TableCell className="font-medium">{summary.plateNumber}</TableCell>
                    <TableCell>{summary.brandModel}</TableCell>
                    <TableCell className="text-right">C${summary.totalPreventiveCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">C${summary.totalCorrectiveCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">C${summary.totalCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{summary.logCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

       <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Desglose de Costos (Gráfico Marcador de Posición)</CardTitle>
          <CardDescription>Representación visual de los costos de mantenimiento por tipo o categoría. La funcionalidad completa depende de la implementación de la base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Replace with actual chart component when data is available */}
           <div className="h-64 bg-muted rounded-md flex items-center justify-center">
            <Image 
              src="https://placehold.co/800x300.png" 
              alt="Marcador de Posición de Gráfico de Desglose de Costos" 
              width={800} 
              height={300}
              data-ai-hint="cost chart"
              className="rounded-md"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
