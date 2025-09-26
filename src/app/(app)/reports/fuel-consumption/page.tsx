
"use client"; // Client page; data fetched via API endpoints

import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { Fuel, FileDown, CalendarDays, Printer } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { exportToXLSX } from "@/lib/export-excel";
import { formatCurrency, formatNumber } from "@/lib/currency";
import type { FuelConsumptionSummary } from "@/lib/actions/report-actions";
import type { Vehicle } from "@/types";
import { VehicleMultiSelect } from "@/components/vehicles/vehicle-multi-select";

export default function FuelConsumptionReportPage() {
  const [summaries, setSummaries] = useState<FuelConsumptionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });
  const [sortBy, setSortBy] = useState<string>("km_desc");

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
        to = today;
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
          const v: Vehicle[] = await resV.json();
          setVehicles(v);
        }
        const params = new URLSearchParams();
        if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
        // Fetch all summaries for the date range; we'll filter client-side by multi-select
        const res = await fetch(`/api/reports/fuel-consumption?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error cargando informe: ${res.status}`);
        const data: FuelConsumptionSummary[] = await res.json();
        setSummaries(data.filter((d) => (d.logCount || 0) > 0));
      } catch (error) {
        console.error("Error loading fuel consumption report data:", error);
        setSummaries([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadReportData();
  }, [dateRange?.from, dateRange?.to]);

  // Client-side filter by multi-select (if any selected)
  const filteredSummaries = useMemo(() => {
    if (!selectedVehicleIds.length) return summaries;
    const set = new Set(selectedVehicleIds);
    return summaries.filter((s) => (s as any).vehicleId && set.has(String((s as any).vehicleId)));
  }, [summaries, selectedVehicleIds]);

  // KPIs aggregated over filtered summaries
  const kpis = useMemo(() => {
    if (!filteredSummaries || filteredSummaries.length === 0) {
      return {
        totalLiters: 0,
        totalGallons: 0,
        totalCost: 0,
        weightedEfficiencyKmPerGal: null as number | null,
        totalLogs: 0,
        vehiclesCount: 0,
        totalKilometers: 0,
        costPerKm: null as number | null,
      };
    }
    const totalLiters = filteredSummaries.reduce((a, s) => a + (s.totalLiters || 0), 0);
    const totalGallons = filteredSummaries.reduce((a, s) => a + (s.totalGallons || 0), 0);
    const totalCost = filteredSummaries.reduce((a, s) => a + (s.totalCost || 0), 0);
    const totalLogs = filteredSummaries.reduce((a, s) => a + (s.logCount || 0), 0);
    const totalKilometers = filteredSummaries.reduce((a, s) => a + (s.totalKilometers || 0), 0);
    // Weighted average efficiency by gallons (approximation)
    const effNumerator = filteredSummaries.reduce((a, s) => a + ((s.avgEfficiency ?? 0) * (s.totalGallons || 0)), 0);
    const effDenominator = filteredSummaries.reduce((a, s) => a + ((s.avgEfficiency != null ? (s.totalGallons || 0) : 0)), 0);
    const weightedEfficiencyKmPerGal = effDenominator > 0 ? (effNumerator / effDenominator) : null;
    const costPerKm = totalKilometers > 0 ? (totalCost / totalKilometers) : null;
    return {
      totalLiters,
      totalGallons,
      totalCost,
      weightedEfficiencyKmPerGal,
      totalLogs,
      vehiclesCount: filteredSummaries.length,
      totalKilometers,
      costPerKm,
    };
  }, [filteredSummaries]);
  const handlePrint = () => {
    window.print();
  };

  // Sort by selected criterion
  const sortedSummaries = useMemo(() => {
    const arr = [...filteredSummaries];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "km_desc": {
          const akm = a.totalKilometers ?? -1;
          const bkm = b.totalKilometers ?? -1;
          return bkm - akm;
        }
        case "cost_desc":
          return (b.totalCost ?? 0) - (a.totalCost ?? 0);
        case "gallons_desc":
          return (b.totalGallons ?? 0) - (a.totalGallons ?? 0);
        case "eff_desc": {
          const ae = a.avgEfficiency ?? -1;
          const be = b.avgEfficiency ?? -1;
          return be - ae;
        }
        case "plate_asc":
          return (a.plateNumber || "").localeCompare(b.plateNumber || "");
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredSummaries, sortBy]);

  const handleExportCSV = () => {
    if (sortedSummaries.length === 0) return;
    const headers = [
      "Vehículo (Matrícula)",
      "Marca y Modelo",
      "Galones Totales",
      "Costo Total (C$)",
      "Costo/gal (C$)",
      "KM Recorridos",
      "Costo/km (C$)",
      "Eficiencia Prom. (km/gal)",
      "Núm. Registros",
    ];
    const csvRows = [
      headers.join(","),
      ...sortedSummaries.map((s) => {
        const costPerGallon = (s.totalGallons || 0) > 0 ? s.totalCost / (s.totalGallons || 1) : null;
        const costPerKm = (s.totalKilometers && s.totalKilometers > 0) ? s.totalCost / s.totalKilometers : null;
        return [
          s.plateNumber,
          s.brandModel,
          formatNumber(s.totalGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          formatCurrency(s.totalCost),
          costPerGallon != null ? formatCurrency(costPerGallon) : "N/A",
          s.totalKilometers != null ? formatNumber(s.totalKilometers, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "N/A",
          costPerKm != null ? formatCurrency(costPerKm) : "N/A",
          s.avgEfficiency != null ? formatNumber(s.avgEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "N/A",
          String(s.logCount ?? 0),
        ].join(",");
      }),
    ];
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "informe_consumo_combustible.csv");
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXLSX = () => {
    if (sortedSummaries.length === 0) return;
    const rows = sortedSummaries.map((s) => {
      const costPerGallon = (s.totalGallons || 0) > 0 ? s.totalCost / (s.totalGallons || 1) : null;
      const costPerKm = (s.totalKilometers && s.totalKilometers > 0) ? s.totalCost / s.totalKilometers : null;
      return {
        "Vehículo (Matrícula)": s.plateNumber,
        "Marca y Modelo": s.brandModel,
        "Galones Totales": Number((s.totalGallons ?? 0).toFixed(2)),
        "Costo Total (C$)": Number((s.totalCost ?? 0).toFixed(2)),
        "Costo/gal (C$)": costPerGallon != null ? Number(costPerGallon.toFixed(2)) : null,
        "KM Recorridos": s.totalKilometers ?? null,
        "Costo/km (C$)": costPerKm != null ? Number(costPerKm.toFixed(2)) : null,
        "Eficiencia Prom. (km/gal)": s.avgEfficiency != null ? Number((s.avgEfficiency as number).toFixed(1)) : null,
        "Núm. Registros": s.logCount ?? 0,
      } as const;
    });
    exportToXLSX(rows, "informe_consumo_combustible.xlsx");
  };
      return (
    <>
      <PageHeader
        title="Informe de Consumo de Combustible"
        description="Analiza el uso de combustible, costos y eficiencia."
        icon={Fuel}
      />
      {/* Single-line toolbar: all controls aligned to the right */}
  <div className="mb-4 flex flex-wrap md:flex-nowrap items-center gap-1.5 justify-end">
        <VehicleMultiSelect
          vehicles={vehicles}
          selectedIds={selectedVehicleIds}
          onChange={setSelectedVehicleIds}
          buttonLabel="Vehículos"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start">
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "P", { locale: es })} - ${format(dateRange.to, "P", { locale: es })}`
                : "Rango de fechas"}
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
        <div className="min-w-[200px]">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km_desc">KM Recorridos (desc)</SelectItem>
              <SelectItem value="cost_desc">Costo Total (desc)</SelectItem>
              <SelectItem value="gallons_desc">Galones Totales (desc)</SelectItem>
              <SelectItem value="eff_desc">Eficiencia Prom. (desc)</SelectItem>
              <SelectItem value="plate_asc">Matrícula (asc)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button variant="outline" onClick={handleExportCSV} disabled={sortedSummaries.length === 0}>
          <FileDown className="mr-2 h-4 w-4" /> CSV
        </Button>
        <Button
          variant="default"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={handleExportXLSX}
          disabled={sortedSummaries.length === 0}
        >
          <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
        </Button>
      </div>

      <Card className="shadow-lg printable-area">
        {/* KPI cards: quick glance metrics */}
        <CardHeader>
          <CardTitle className="text-2xl">Indicadores Clave</CardTitle>
          <CardDescription>Totales y promedios del período seleccionado.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Calculando indicadores...</p>
          ) : filteredSummaries.length === 0 ? (
            <p className="text-muted-foreground">No hay datos para mostrar indicadores.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="rounded-md border p-4 h-full flex flex-col items-center text-center gap-1">
                <div className="text-sm font-medium text-muted-foreground">Galones Totales</div>
                <div className="text-2xl font-semibold">{formatNumber(kpis.totalGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-muted-foreground">({formatNumber(kpis.totalLiters, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</div>
              </div>
              <div className="rounded-md border p-4 h-full flex flex-col items-center text-center gap-1">
                <div className="text-sm font-medium text-muted-foreground">Costo Total (C$)</div>
                <div className="text-2xl font-semibold">{formatCurrency(kpis.totalCost)}</div>
              </div>
              <div className="rounded-md border p-4 h-full flex flex-col items-center text-center gap-1">
                <div className="text-sm font-medium text-muted-foreground">Eficiencia Prom. Ponderada</div>
                <div className="text-2xl font-semibold">{kpis.weightedEfficiencyKmPerGal != null ? `${formatNumber(kpis.weightedEfficiencyKmPerGal, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal` : 'N/A'}</div>
              </div>
              <div className="rounded-md border p-4 h-full flex flex-col items-center text-center gap-1">
                <div className="text-sm font-medium text-muted-foreground">Núm. Registros</div>
                <div className="text-2xl font-semibold">{kpis.totalLogs}</div>
              </div>
              <div className="rounded-md border p-4 h-full flex flex-col items-center text-center gap-1">
                <div className="text-sm font-medium text-muted-foreground">KM Totales</div>
                <div className="text-2xl font-semibold">{formatNumber(kpis.totalKilometers, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-md border p-4 h-full flex flex-col items-center text-center gap-1">
                <div className="text-sm font-medium text-muted-foreground">Costo/km (C$)</div>
                <div className="text-2xl font-semibold">{kpis.costPerKm != null ? formatCurrency(kpis.costPerKm) : 'N/A'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      

      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">Resumen por Vehículo</CardTitle>
          <CardDescription>Consumo total de combustible y costos por vehículo, filtrables por rango de fechas y vehículo.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : filteredSummaries.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de combustible disponibles para generar el informe. Verifique la implementación de la conexión con la base de datos y los registros existentes.</p>
          ) : (
            <Table className="text-base [&_th]:px-4 [&_th]:py-2 md:[&_th]:py-3 [&_td]:px-4 [&_td]:py-2 md:[&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Vehículo (Matrícula)</TableHead>
                  <TableHead className="font-semibold">Marca y Modelo</TableHead>
                  <TableHead className="text-right font-semibold">Galones Totales</TableHead>
                  <TableHead className="text-right font-semibold">Costo Total (C$)</TableHead>
                  <TableHead className="text-right font-semibold">Costo/gal (C$)</TableHead>
                  <TableHead className="text-right font-semibold">KM Recorridos</TableHead>
                  <TableHead className="text-right font-semibold">Costo/km (C$)</TableHead>
                  <TableHead className="text-right font-semibold">Eficiencia Prom. (km/gal)</TableHead>
                  <TableHead className="text-right font-semibold">Núm. Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSummaries.map((summary) => (
                  <TableRow key={summary.vehicleId}>
                    <TableCell className="font-medium">{summary.plateNumber}</TableCell>
                    <TableCell>{summary.brandModel}</TableCell>
                    <TableCell className="text-right">{formatNumber(summary.totalGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalCost)}</TableCell>
                    <TableCell className="text-right">{summary.totalGallons > 0 ? formatCurrency(summary.totalCost / summary.totalGallons) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{summary.totalKilometers != null ? formatNumber(summary.totalKilometers, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{summary.totalKilometers && summary.totalKilometers > 0 ? formatCurrency(summary.totalCost / summary.totalKilometers) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{summary.avgEfficiency ? formatNumber(summary.avgEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A'}</TableCell>
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
          <CardTitle>Comparación por Vehículo</CardTitle>
          <CardDescription>Galones totales y costo total por vehículo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              gallons: { label: "Galones", color: "hsl(var(--chart-1))" },
              cost: { label: "Costo (C$)", color: "hsl(var(--chart-2))" },
            }}
            className="h-72 lg:h-80"
          >
            <ResponsiveContainer>
              <BarChart data={sortedSummaries.map((s) => ({ name: s.plateNumber, gallons: Number((s.totalGallons ?? 0).toFixed(2)), cost: Number((s.totalCost ?? 0).toFixed(2)) }))} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} width={72} tickMargin={8} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={84} tickMargin={8}
                  tickFormatter={(v) => formatCurrency(Number(v))}
                />
                <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any, name: any) => {
                  if (name === 'gallons') return `Galones: ${formatNumber(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  if (name === 'cost') return `Costo: ${formatCurrency(Number(value))}`;
                  return String(value);
                }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="left" dataKey="gallons" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
                <Bar yAxisId="right" dataKey="cost" fill="hsl(var(--chart-2))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Eficiencia por Vehículo</CardTitle>
          <CardDescription>Promedio de eficiencia (km/gal) por vehículo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              efficiency: { label: "Eficiencia (km/gal)", color: "hsl(var(--chart-3))" },
            }}
            className="h-72 lg:h-80"
          >
            <ResponsiveContainer>
              <BarChart data={sortedSummaries.filter((s) => s.avgEfficiency != null).map((s) => ({ name: s.plateNumber, efficiency: Number((s.avgEfficiency as number).toFixed(1)) }))} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={72} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any, name: any) => {
                  if (name === 'efficiency') return `Eficiencia: ${formatNumber(Number(value), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal`;
                  return String(value);
                }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="efficiency" fill="hsl(var(--chart-3))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
