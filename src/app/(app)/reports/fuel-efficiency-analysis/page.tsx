
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import type { FuelingLog, Vehicle } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import { getFuelingLogs } from "@/lib/actions/fueling-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import Image from "next/image";

interface VehicleEfficiencyData {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  averageEfficiency?: number;
  minEfficiency?: number;
  maxEfficiency?: number;
  logCount: number;
}

export default function FuelEfficiencyAnalysisPage() {
  const [efficiencyData, setEfficiencyData] = useState<VehicleEfficiencyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const fuelingLogsData = await getFuelingLogs();
        const vehiclesData = await getVehicles();

        if (!vehiclesData || vehiclesData.length === 0) {
          setEfficiencyData([]);
          setIsLoading(false);
          return;
        }

        const processedData: VehicleEfficiencyData[] = vehiclesData.map(vehicle => {
          const logsForVehicle = fuelingLogsData.filter(
            log => log.vehicleId === vehicle.id && log.fuelEfficiencyKmPerGallon !== undefined && log.fuelEfficiencyKmPerGallon !== null && !isNaN(log.fuelEfficiencyKmPerGallon)
          );
          
          const efficiencies = logsForVehicle.map(log => log.fuelEfficiencyKmPerGallon as number);

          if (efficiencies.length === 0) {
            return {
              vehicleId: vehicle.id,
              plateNumber: vehicle.plateNumber,
              brandModel: `${vehicle.brand} ${vehicle.model}`,
              logCount: 0,
            };
          }

          const sumEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0);
          const averageEfficiency = sumEfficiency / efficiencies.length;
          const minEfficiency = Math.min(...efficiencies);
          const maxEfficiency = Math.max(...efficiencies);
          
          return {
            vehicleId: vehicle.id,
            plateNumber: vehicle.plateNumber,
            brandModel: `${vehicle.brand} ${vehicle.model}`,
            averageEfficiency,
            minEfficiency,
            maxEfficiency,
            logCount: efficiencies.length,
          };
        }).filter(data => data.logCount > 0); // Only include vehicles with efficiency data
        
        setEfficiencyData(processedData);
      } catch (error) {
        console.error("Error loading fuel efficiency analysis data:", error);
        setEfficiencyData([]);
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
    if (efficiencyData.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Eficiencia Prom. (km/gal)", "Eficiencia Mín. (km/gal)", "Eficiencia Máx. (km/gal)", "Núm. Registros"];
    const reportRows = [
      headers.join('\t'), // Use tab as separator
      ...efficiencyData.map(d => [
        d.plateNumber,
        d.brandModel,
        d.averageEfficiency?.toFixed(1) ?? 'N/A',
        d.minEfficiency?.toFixed(1) ?? 'N/A',
        d.maxEfficiency?.toFixed(1) ?? 'N/A',
        d.logCount
      ].join('\t'))
    ];
    const reportString = reportRows.join('\n');
    const blob = new Blob([reportString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_analisis_eficiencia.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  return (
    <>
      <PageHeader
        title="Informe de Análisis de Eficiencia de Combustible"
        description="Analiza tendencias y compara la eficiencia de combustible (km/gal) entre vehículos."
        icon={TrendingUp}
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
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportExcel} disabled={efficiencyData.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Exportar Informe (Excel)
            </Button>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Análisis de Eficiencia por Vehículo</CardTitle>
          <CardDescription>
            Promedio, mínimo y máximo de eficiencia de combustible (km/gal). Los datos se mostrarán una vez implementada la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : efficiencyData.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de eficiencia de combustible disponibles o registros de combustible con cálculo de eficiencia. Verifique la implementación de la base de datos y los registros existentes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo (Matrícula)</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead className="text-right">Eficiencia Prom. (km/gal)</TableHead>
                  <TableHead className="text-right">Eficiencia Mín. (km/gal)</TableHead>
                  <TableHead className="text-right">Eficiencia Máx. (km/gal)</TableHead>
                  <TableHead className="text-right">Núm. Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {efficiencyData.map(data => (
                  <TableRow key={data.vehicleId}>
                    <TableCell className="font-medium">{data.plateNumber}</TableCell>
                    <TableCell>{data.brandModel}</TableCell>
                    <TableCell className="text-right">{data.averageEfficiency?.toFixed(1) ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{data.minEfficiency?.toFixed(1) ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{data.maxEfficiency?.toFixed(1) ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{data.logCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Gráfico de Tendencias de Eficiencia (Marcador de posición)</CardTitle>
          <CardDescription>Representación visual de la eficiencia a lo largo del tiempo o por vehículo. Funcionalidad pendiente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center">
             <Image 
              src="https://placehold.co/800x300.png" 
              alt="Marcador de Posición de Gráfico de Eficiencia" 
              width={800} 
              height={300}
              data-ai-hint="efficiency chart"
              className="rounded-md"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
