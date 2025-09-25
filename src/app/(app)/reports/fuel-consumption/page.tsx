
"use client"; // Client page; data fetched via API endpoints

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
import { Fuel, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";
import type { FuelConsumptionSummary } from "@/lib/actions/report-actions";
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
import type { Vehicle } from "@/types";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function FuelConsumptionReportPage() {
  const [summaries, setSummaries] = useState<FuelConsumptionSummary[]>([]);
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
          const resV = await fetch("/api/vehicles/list", { cache: "no-store" });
          if (!resV.ok) throw new Error(`Error cargando vehículos: ${resV.status}`);
          const v = await resV.json();
          setVehicles(v);
        }
        const params = new URLSearchParams();
        if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
        if (selectedVehicleId !== "all") params.set("vehicleId", selectedVehicleId);
        const res = await fetch(`/api/reports/fuel-consumption?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error cargando informe: ${res.status}`);
        const data: FuelConsumptionSummary[] = await res.json();
        setSummaries(data.filter(d => d.logCount > 0));
      } catch (error) {
        console.error("Error loading fuel consumption report data:", error);
        setSummaries([]);
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

  const handleExportXLSX = async () => {
    if (summaries.length === 0) return;
    const rows = summaries.map(s => ({
      plate: s.plateNumber,
      brandModel: s.brandModel,
      totalLiters: Number(s.totalLiters.toFixed(2)),
      totalGallons: Number(s.totalGallons.toFixed(2)),
      totalCost: Number(s.totalCost.toFixed(2)),
      avgEff: s.avgEfficiency ? Number(s.avgEfficiency.toFixed(1)) : null,
      logCount: s.logCount,
    }));
    await exportToXLSX({
      rows,
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "brandModel", header: "Marca y Modelo", width: 28 },
        { key: "totalLiters", header: "Litros Totales", format: "decimal" },
        { key: "totalGallons", header: "Galones Totales", format: "decimal" },
        { key: "totalCost", header: "Costo Total (C$)", format: "currency", numFmt: "[$C$] #,##0.00" },
        { key: "avgEff", header: "Eficiencia Prom. (km/gal)", format: "decimal" },
        { key: "logCount", header: "Núm. Registros", format: "integer" },
      ],
    }, "informe_consumo_combustible", "Consumo");
  };

  return (
    <>
      <PageHeader
        title="Informe de Consumo de Combustible"
        description="Analiza el uso de combustible, costos y eficiencia."
        icon={Fuel}
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
              <Button variant="outline" onClick={handleExportCSV} disabled={summaries.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={summaries.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
              </Button>
            </div>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">Resumen por Vehículo</CardTitle>
          <CardDescription>Consumo total de combustible y costos por vehículo, filtrables por rango de fechas y vehículo.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : summaries.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de combustible disponibles para generar el informe. Verifique la implementación de la conexión con la base de datos y los registros existentes.</p>
          ) : (
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Vehículo (Matrícula)</TableHead>
                  <TableHead className="font-semibold">Marca y Modelo</TableHead>
                  <TableHead className="text-right font-semibold">Galones Totales</TableHead>
                  <TableHead className="text-right font-semibold">Costo Total (C$)</TableHead>
                  <TableHead className="text-right font-semibold">Eficiencia Prom. (km/gal)</TableHead>
                  <TableHead className="text-right font-semibold">Núm. Registros</TableHead>
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
          <ChartContainer
            config={{
              gallons: { label: "Galones", color: "#2563eb" },
              cost: { label: "Costo (C$)", color: "#22c55e" },
            }}
            className="h-64"
          >
            <BarChart data={summaries.map(s => ({ label: s.plateNumber, gallons: Number(s.totalGallons.toFixed(2)), cost: Number(s.totalCost.toFixed(2)) }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="gallons" fill="var(--color-gallons)" />
              <Bar dataKey="cost" fill="var(--color-cost)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
