
"use client"; // This page will need client-side interaction for filters and potentially charts

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileDown, Filter, CalendarDays, ListChecks, Printer } from "lucide-react";
import type { FuelingLog, MaintenanceLog, Vehicle } from "@/types";
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
import { getFuelingLogs } from "@/lib/actions/fueling-actions";
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";

type VehicleOverallCostSummary = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  totalFuelingCost: number;
  fuelingLogCount: number; 
  totalMaintenanceCost: number;
  maintenanceLogCount: number; 
  grandTotalCost: number;
};

export default function OverallVehicleCostsReportPage() {
  const [summaries, setSummaries] = useState<VehicleOverallCostSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const vehiclesData = await getVehicles();
        const fuelingLogsData = await getFuelingLogs();
        const maintenanceLogsData = await getMaintenanceLogs();

        if (!vehiclesData || vehiclesData.length === 0) {
          setSummaries([]);
          setIsLoading(false);
          return;
        }

        const processedSummaries: VehicleOverallCostSummary[] = vehiclesData.map(vehicle => {
          const vehicleFuelingLogs = fuelingLogsData.filter(log => log.vehicleId === vehicle.id);
          const totalFuelingCost = vehicleFuelingLogs.reduce((sum, log) => sum + log.totalCost, 0);

          const vehicleMaintenanceLogs = maintenanceLogsData.filter(log => log.vehicleId === vehicle.id);
          const totalMaintenanceCost = vehicleMaintenanceLogs.reduce((sum, log) => sum + log.cost, 0);
          
          const grandTotalCost = totalFuelingCost + totalMaintenanceCost;
          
          return {
            vehicleId: vehicle.id,
            plateNumber: vehicle.plateNumber,
            brandModel: `${vehicle.brand} ${vehicle.model}`,
            totalFuelingCost,
            fuelingLogCount: vehicleFuelingLogs.length, 
            totalMaintenanceCost,
            maintenanceLogCount: vehicleMaintenanceLogs.length, 
            grandTotalCost
          };
        }).filter(summary => summary.fuelingLogCount > 0 || summary.maintenanceLogCount > 0); 
        
        setSummaries(processedSummaries);
      } catch (error) {
        console.error("Error loading overall vehicle costs report data:", error);
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

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Costo Combustible (C$)", "Costo Mantenimiento (C$)", "Costo Total General (C$)"];
    const reportRows = [
      headers.join('\t'), // Use tab as separator
      ...summaries.map(s => [
        s.plateNumber,
        s.brandModel,
        `C$${s.totalFuelingCost.toFixed(2)}`,
        `C$${s.totalMaintenanceCost.toFixed(2)}`,
        `C$${s.grandTotalCost.toFixed(2)}`
      ].join('\t'))
    ];
    const reportString = reportRows.join('\n');
    const blob = new Blob([reportString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_costos_generales.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <PageHeader
        title="Informe de Costos Generales por Vehículo"
        description="Consolida los gastos de combustible y mantenimiento para cada vehículo."
        icon={ListChecks}
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
          <CardTitle>Resumen de Costos por Vehículo</CardTitle>
          <CardDescription>
            Costos totales de combustible y mantenimiento. Los datos se mostrarán una vez implementada la conexión y lógica de base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : summaries.length === 0 ? (
            <p className="text-muted-foreground">No hay datos disponibles para generar el informe. Verifique la implementación de la conexión con la base de datos y los registros existentes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo (Matrícula)</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead className="text-right">Costo Combustible (C$)</TableHead>
                  <TableHead className="text-right">Costo Mantenimiento (C$)</TableHead>
                  <TableHead className="text-right">Costo Total General (C$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map(summary => (
                  <TableRow key={summary.vehicleId}>
                    <TableCell className="font-medium">{summary.plateNumber}</TableCell>
                    <TableCell>{summary.brandModel}</TableCell>
                    <TableCell className="text-right">C${summary.totalFuelingCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">C${summary.totalMaintenanceCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">C${summary.grandTotalCost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Visualización de Costos (Marcador de posición)</CardTitle>
          <CardDescription>Gráfico comparativo de costos por vehículo. Funcionalidad pendiente de implementación de base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center">
            <Image 
              src="https://placehold.co/800x300.png" 
              alt="Marcador de Posición de Gráfico de Costos Generales" 
              width={800} 
              height={300}
              data-ai-hint="financial chart"
              className="rounded-md"
            />
          </div>
            <p className="text-sm text-muted-foreground mt-4">El gráfico de costos generales estará aquí una vez conectada la base de datos e implementada la lógica correspondiente.</p>
        </CardContent>
      </Card>
    </>
  );
}
