
"use client"; // Client for interactions; aggregation is server-side

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
import { DollarSign, FileDown, Filter, CalendarDays, ListChecks, Printer } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";
import type { OverallVehicleCostSummary } from "@/lib/actions/report-actions";
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
import { getOverallVehicleCostsSummary } from "@/lib/actions/report-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import type { Vehicle } from "@/types";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function OverallVehicleCostsReportPage() {
  const [summaries, setSummaries] = useState<OverallVehicleCostSummary[]>([]);
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
        const data = await getOverallVehicleCostsSummary(params);
        const filtered = data.filter(s => s.fuelingLogCount > 0 || s.maintenanceLogCount > 0);
        setSummaries(filtered);
      } catch (error) {
        console.error("Error loading overall vehicle costs report data:", error);
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

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Costo Combustible (C$)", "Costo Mantenimiento (C$)", "Costo Total General (C$)"];
    const csvRows = [
      headers.join(','),
      ...summaries.map(s => [
        s.plateNumber,
        s.brandModel,
        `C$${s.totalFuelingCost.toFixed(2)}`,
        `C$${s.totalMaintenanceCost.toFixed(2)}`,
        `C$${s.grandTotalCost.toFixed(2)}`
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_costos_generales.csv');
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
      fuelCost: Number(s.totalFuelingCost.toFixed(2)),
      maintCost: Number(s.totalMaintenanceCost.toFixed(2)),
      totalCost: Number(s.grandTotalCost.toFixed(2)),
    }));
    await exportToXLSX({
      rows,
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "brandModel", header: "Marca y Modelo", width: 28 },
        { key: "fuelCost", header: "Costo Combustible (C$)", format: "currency", numFmt: "[$C$] #,##0.00" },
        { key: "maintCost", header: "Costo Mantenimiento (C$)", format: "currency", numFmt: "[$C$] #,##0.00" },
        { key: "totalCost", header: "Costo Total General (C$)", format: "currency", numFmt: "[$C$] #,##0.00" },
      ],
    }, "informe_costos_generales", "Costos");
  };

  return (
    <>
      <PageHeader
        title="Informe de Costos Generales por Vehículo"
        description="Consolida los gastos de combustible y mantenimiento para cada vehículo."
        icon={ListChecks}
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
          <ChartContainer
            config={{
              fuel: { label: "Combustible", color: "#22c55e" },
              maint: { label: "Mantenimiento", color: "#f59e0b" },
            }}
            className="h-64"
          >
            <BarChart data={summaries.map(s => ({ label: s.plateNumber, fuel: s.totalFuelingCost, maint: s.totalMaintenanceCost }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="fuel" stackId="cost" fill="var(--color-fuel)" />
              <Bar dataKey="maint" stackId="cost" fill="var(--color-maint)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
