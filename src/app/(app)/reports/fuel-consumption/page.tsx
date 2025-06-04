
"use client"; // This page will need client-side interaction for filters and potentially charts

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fuel, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import type { FuelingLog, Vehicle } from "@/types";
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
import { getVehicles } from "@/lib/actions/vehicle-actions";

const LITERS_PER_GALLON = 3.78541;

type VehicleFuelSummary = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  totalGallons: number;
  totalCost: number;
  avgEfficiency?: number;
  logCount: number;
};

export default function FuelConsumptionReportPage() {
  const [summaries, setSummaries] = useState<VehicleFuelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const fuelingLogsData = await getFuelingLogs();
        const vehiclesData = await getVehicles();

        if (!vehiclesData || vehiclesData.length === 0) {
          setSummaries([]);
          setIsLoading(false);
          return;
        }

        const processedSummaries: VehicleFuelSummary[] = vehiclesData.map(vehicle => {
          const logsForVehicle: FuelingLog[] = fuelingLogsData.filter(log => log.vehicleId === vehicle.id);
          
          const totalLiters = logsForVehicle.reduce((sum, log) => sum + log.quantityLiters, 0);
          const totalGallons = totalLiters / LITERS_PER_GALLON;
          const totalCost = logsForVehicle.reduce((sum, log) => sum + log.totalCost, 0);
          
          const efficiencies = logsForVehicle
            .map(log => log.fuelEfficiencyKmPerGallon)
            .filter(eff => eff !== undefined && eff !== null && !isNaN(eff)) as number[];
          
          const avgEfficiency = efficiencies.length > 0 ? efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length : undefined;
          
          return {
            vehicleId: vehicle.id,
            plateNumber: vehicle.plateNumber,
            brandModel: `${vehicle.brand} ${vehicle.model}`,
            totalGallons,
            totalCost,
            avgEfficiency,
            logCount: logsForVehicle.length
          };
        }).filter(summary => summary.logCount > 0);
        
        setSummaries(processedSummaries);
      } catch (error) {
        console.error("Error loading fuel consumption report data:", error);
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

  const handleExportCSV = () => {
    if (summaries.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Galones Totales", "Costo Total (C$)", "Eficiencia Prom. (km/gal)", "Núm. Registros"];
    const csvRows = [
      headers.join(','),
      ...summaries.map(s => [
        s.plateNumber,
        s.brandModel,
        s.totalGallons.toFixed(2),
        `C$${s.totalCost.toFixed(2)}`,
        s.avgEfficiency ? s.avgEfficiency.toFixed(1) : 'N/A',
        s.logCount
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_consumo_combustible.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <PageHeader
        title="Informe de Consumo de Combustible"
        description="Analiza el uso de combustible, costos y eficiencia."
        icon={Fuel}
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
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportCSV} disabled={summaries.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Exportar Informe (CSV)
            </Button>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Resumen por Vehículo</CardTitle>
          <CardDescription>Consumo total de combustible y costos por vehículo. Los datos se mostrarán una vez implementada la conexión y lógica de base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : summaries.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de combustible disponibles para generar el informe. Verifique la implementación de la conexión con la base de datos y los registros existentes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo (Matrícula)</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead className="text-right">Galones Totales</TableHead>
                  <TableHead className="text-right">Costo Total (C$)</TableHead>
                  <TableHead className="text-right">Eficiencia Prom. (km/gal)</TableHead>
                  <TableHead className="text-right">Núm. Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map(summary => (
                  <TableRow key={summary.vehicleId}>
                    <TableCell className="font-medium">{summary.plateNumber}</TableCell>
                    <TableCell>{summary.brandModel}</TableCell>
                    <TableCell className="text-right">{summary.totalGallons.toFixed(2)}</TableCell>
                    <TableCell className="text-right">C${summary.totalCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{summary.avgEfficiency ? summary.avgEfficiency.toFixed(1) : 'N/A'}</TableCell>
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
          <CardTitle>Registros Detallados (Marcador de posición)</CardTitle>
          <CardDescription>Entradas individuales de carga de combustible. Esta sección normalmente tendría paginación y filtros más detallados. La funcionalidad completa depende de la implementación de la base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center">
            {/* TODO: Replace with actual chart/table component when data is available */}
            <Image 
              src="https://placehold.co/800x300.png" 
              alt="Marcador de Posición de Gráfico de Registros Detallados" 
              width={800} 
              height={300}
              data-ai-hint="data table"
              className="rounded-md"
            />
          </div>
            <p className="text-sm text-muted-foreground mt-4">La tabla de registros detallados estará aquí una vez conectada la base de datos e implementada la lógica correspondiente.</p>
        </CardContent>
      </Card>
    </>
  );
}
