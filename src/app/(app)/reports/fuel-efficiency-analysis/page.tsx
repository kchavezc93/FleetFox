
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { TrendingUp, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";
import type { FuelEfficiencyStats } from "@/lib/actions/report-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import { getFuelEfficiencyStats } from "@/lib/actions/report-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import type { Vehicle } from "@/types";
import Image from "next/image";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function FuelEfficiencyAnalysisPage() {
  const [efficiencyData, setEfficiencyData] = useState<FuelEfficiencyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });

  const applyPreset = (preset: string) => {
    const today = new Date();
    let from = today;
    let to = today;
    switch (preset) {
      case "last7":
        from = subDays(today, 6);
        break;
      case "last30":
        from = subDays(today, 29);
        break;
      case "last90":
        from = subDays(today, 89);
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "lastMonth": {
        const prev = subMonths(today, 1);
        from = startOfMonth(prev);
        to = endOfMonth(prev);
        break;
      }
      case "ytd":
        from = startOfYear(today);
        break;
    }
    setDateRange({ from, to });
  };

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        if (vehicles.length === 0) {
          const v = await getVehicles();
          setVehicles(v);
        }
        const params: { startDate?: string; endDate?: string; vehicleId?: string } = {};
        if (dateRange?.from) params.startDate = format(dateRange.from, "yyyy-MM-dd");
        if (dateRange?.to) params.endDate = format(dateRange.to, "yyyy-MM-dd");
        if (selectedVehicleId !== "all") params.vehicleId = selectedVehicleId;
        const data = await getFuelEfficiencyStats(params);
        setEfficiencyData(data.filter(d => d.logCount > 0));
      } catch (error) {
        console.error("Error loading fuel efficiency analysis data:", error);
        setEfficiencyData([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadReportData();
  }, [selectedVehicleId, dateRange?.from, dateRange?.to]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (efficiencyData.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Eficiencia Prom. (km/gal)", "Eficiencia Mín. (km/gal)", "Eficiencia Máx. (km/gal)", "Núm. Registros"];
    const csvRows = [
      headers.join(','),
      ...efficiencyData.map(d => [
        d.plateNumber,
        d.brandModel,
        d.averageEfficiency?.toFixed(1) ?? 'N/A',
        d.minEfficiency?.toFixed(1) ?? 'N/A',
        d.maxEfficiency?.toFixed(1) ?? 'N/A',
        d.logCount
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_analisis_eficiencia.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXLSX = async () => {
    if (efficiencyData.length === 0) return;
    const rows = efficiencyData.map(d => ({
      "Vehículo (Matrícula)": d.plateNumber,
      "Marca y Modelo": d.brandModel,
      "Eficiencia Prom. (km/gal)": d.averageEfficiency != null ? Number(d.averageEfficiency.toFixed(1)) : null,
      "Eficiencia Mín. (km/gal)": d.minEfficiency != null ? Number(d.minEfficiency.toFixed(1)) : null,
      "Eficiencia Máx. (km/gal)": d.maxEfficiency != null ? Number(d.maxEfficiency.toFixed(1)) : null,
      "Núm. Registros": d.logCount,
    }));
    await exportToXLSX(rows, "informe_analisis_eficiencia", "Eficiencia");
  };


  return (
    <>
      <PageHeader
        title="Informe de Análisis de Eficiencia de Combustible"
        description="Analiza tendencias y compara la eficiencia de combustible (km/gal) entre vehículos."
        icon={TrendingUp}
        actions={
          <div className="page-header-actions flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <div className="min-w-[220px]">
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los vehículos</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plateNumber} ({v.brand} {v.model})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateRange?.from && dateRange?.to ? `${format(dateRange.from, "P", {locale: es})} - ${format(dateRange.to, "P", {locale: es})}` : "Rango de fechas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={dateRange}
                    onSelect={setDateRange}
                    defaultMonth={dateRange?.from}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Rangos rápidos</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => applyPreset("last7")}>Últimos 7 días</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyPreset("last30")}>Últimos 30 días</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyPreset("last90")}>Últimos 90 días</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyPreset("thisMonth")}>Este mes</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyPreset("lastMonth")}>Mes anterior</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyPreset("ytd")}>Año en curso (YTD)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
             <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV} disabled={efficiencyData.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={efficiencyData.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
              </Button>
            </div>
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
          <ChartContainer
            config={{
              avg: { label: "Promedio", color: "#2563eb" },
              min: { label: "Mínimo", color: "#ef4444" },
              max: { label: "Máximo", color: "#22c55e" },
            }}
            className="h-64"
          >
            <BarChart data={efficiencyData.map(d => ({ label: d.plateNumber, avg: d.averageEfficiency ?? 0, min: d.minEfficiency ?? 0, max: d.maxEfficiency ?? 0 }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="avg" fill="var(--color-avg)" />
              <Bar dataKey="min" fill="var(--color-min)" />
              <Bar dataKey="max" fill="var(--color-max)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
