
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { TrendingUp, FileDown, CalendarDays, Printer } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";
import type { FuelEfficiencyStats, FuelConsumptionSummary } from "@/lib/actions/report-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import type { Vehicle } from "@/types";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, ReferenceLine, Tooltip as RechartsTooltip } from "recharts";
import { formatNumber } from "@/lib/currency";
import { VehicleMultiSelect } from "@/components/vehicles/vehicle-multi-select";

export default function FuelEfficiencyAnalysisPage() {
  const [efficiencyAll, setEfficiencyAll] = useState<FuelEfficiencyStats[]>([]);
  const [consumptionAll, setConsumptionAll] = useState<FuelConsumptionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });
  const [sortKey, setSortKey] = useState<string>("km_desc");

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
        // Traemos todas las eficiencias del rango (sin filtrar por vehículo aquí)
        const [resEff, resCons] = await Promise.all([
          fetch(`/api/reports/fuel-efficiency?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/reports/fuel-consumption?${params.toString()}`, { cache: "no-store" }),
        ]);
        if (!resEff.ok) throw new Error(`Error cargando informe de eficiencia: ${resEff.status}`);
        if (!resCons.ok) throw new Error(`Error cargando informe de consumo: ${resCons.status}`);
        const dataEff: FuelEfficiencyStats[] = await resEff.json();
        const dataCons: FuelConsumptionSummary[] = await resCons.json();
        setEfficiencyAll((dataEff || []).filter(d => d.logCount > 0));
        setConsumptionAll(dataCons || []);
      } catch (error) {
        console.error("Error loading fuel efficiency analysis data:", error);
        setEfficiencyAll([]);
        setConsumptionAll([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadReportData();
  }, [dateRange?.from, dateRange?.to]);

  const handlePrint = () => {
    window.print();
  };

  // Datos filtrados por selección (0 = todos)
  const selectedSet = new Set(selectedVehicleIds);
  const filteredEfficiency = efficiencyAll.filter(d =>
    selectedVehicleIds.length === 0 || selectedVehicleIds.length === vehicles.length
      ? true
      : selectedSet.has(d.vehicleId)
  );
  const kmByVehicle = new Map<string, number | undefined>(
    consumptionAll.map(c => [c.vehicleId, c.totalKilometers])
  );

  // Consumo filtrado para KPIs globales
  const filteredConsumption = consumptionAll.filter(c =>
    selectedVehicleIds.length === 0 || selectedVehicleIds.length === vehicles.length
      ? true
      : selectedSet.has(c.vehicleId)
  );
  const totalKm = filteredConsumption.reduce((acc, c) => acc + (c.totalKilometers ?? 0), 0);
  const totalGallons = filteredConsumption.reduce((acc, c) => acc + (c.totalGallons ?? 0), 0);
  const totalCost = filteredConsumption.reduce((acc, c) => acc + (c.totalCost ?? 0), 0);
  const weightedEfficiency = totalGallons > 0 ? totalKm / totalGallons : undefined;
  const costPerKm = totalKm > 0 ? totalCost / totalKm : undefined;
  const avgKmPerVehicle = (() => {
    const vals = filteredEfficiency.map(d => kmByVehicle.get(d.vehicleId) ?? 0).filter(v => v > 0);
    if (vals.length === 0) return undefined;
    const s = vals.reduce((a, b) => a + b, 0);
    return s / vals.length;
  })();

  // Ordenamiento
  const sortedEfficiency = [...filteredEfficiency].sort((a, b) => {
    const kmA = kmByVehicle.get(a.vehicleId) ?? 0;
    const kmB = kmByVehicle.get(b.vehicleId) ?? 0;
    const effA = a.averageEfficiency ?? 0;
    const effB = b.averageEfficiency ?? 0;
    switch (sortKey) {
      case "km_asc": return kmA - kmB;
      case "km_desc": return kmB - kmA;
      case "eff_asc": return effA - effB;
      case "eff_desc": return effB - effA;
      case "logs_desc": return (b.logCount ?? 0) - (a.logCount ?? 0);
      case "logs_asc": return (a.logCount ?? 0) - (b.logCount ?? 0);
      default: return kmB - kmA;
    }
  });

  // Tooltip personalizado para dispersión
  const ScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    return (
      <div className="rounded-md border bg-background p-2 text-sm shadow-md">
        <div className="font-medium mb-1">{p.name}</div>
        <div>Km recorridos: {formatNumber(Number(p.km))}</div>
        <div>Eficiencia: {formatNumber(Number(p.eff), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal</div>
      </div>
    );
  };

  // Insight helpers
  const effThreshold = weightedEfficiency ?? (filteredEfficiency.length > 0 ? (filteredEfficiency.reduce((a, b) => a + (b.averageEfficiency ?? 0), 0) / filteredEfficiency.length) : undefined);
  const kmThreshold = avgKmPerVehicle ?? (filteredEfficiency.length > 0 ? ((filteredEfficiency.reduce((a, b) => a + (kmByVehicle.get(b.vehicleId) ?? 0), 0)) / filteredEfficiency.length) : undefined);
  const insightBase = sortedEfficiency.map(d => ({
    id: d.vehicleId,
    name: d.plateNumber,
    eff: d.averageEfficiency ?? 0,
    km: kmByVehicle.get(d.vehicleId) ?? 0,
  }));
  const topEfficiency = [...insightBase].sort((a, b) => b.eff - a.eff).slice(0, 3);
  const highKmGoodEff = insightBase.filter(x => (kmThreshold != null ? x.km >= kmThreshold : x.km > 0) && (effThreshold != null ? x.eff >= effThreshold : true)).sort((a, b) => b.km - a.km).slice(0, 3);
  const lowEffHighKm = insightBase.filter(x => (kmThreshold != null ? x.km >= kmThreshold : x.km > 0) && (effThreshold != null ? x.eff < effThreshold : false)).sort((a, b) => b.km - a.km).slice(0, 3);

  const handleExportCSV = () => {
    if (filteredEfficiency.length === 0) return;

    const headers = [
      "Vehículo (Matrícula)",
      "Marca y Modelo",
      "Eficiencia Prom. (km/gal)",
      "Eficiencia Mín. (km/gal)",
      "Eficiencia Máx. (km/gal)",
      "Km Recorridos",
      "Núm. Registros",
    ];
    const csvRows = [
      headers.join(','),
      ...filteredEfficiency.map(d => [
        d.plateNumber,
        d.brandModel,
        d.averageEfficiency != null ? formatNumber(d.averageEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A',
        d.minEfficiency != null ? formatNumber(d.minEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A',
        d.maxEfficiency != null ? formatNumber(d.maxEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A',
        kmByVehicle.get(d.vehicleId) != null ? formatNumber(kmByVehicle.get(d.vehicleId) as number) : 'N/A',
        d.logCount,
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'analisis_eficiencia_combustible.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXLSX = async () => {
    if (filteredEfficiency.length === 0) return;
    const rows = filteredEfficiency.map(d => ({
      plate: d.plateNumber,
      brandModel: d.brandModel,
      avgEff: d.averageEfficiency != null ? Number(d.averageEfficiency.toFixed(1)) : null,
      minEff: d.minEfficiency != null ? Number(d.minEfficiency.toFixed(1)) : null,
      maxEff: d.maxEfficiency != null ? Number(d.maxEfficiency.toFixed(1)) : null,
      kmDriven: kmByVehicle.get(d.vehicleId) ?? null,
      logCount: d.logCount,
    }));
    await exportToXLSX({
      rows,
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "brandModel", header: "Marca y Modelo", width: 28 },
        { key: "avgEff", header: "Eficiencia Prom. (km/gal)", format: "decimal" },
        { key: "minEff", header: "Eficiencia Mín. (km/gal)", format: "decimal" },
        { key: "maxEff", header: "Eficiencia Máx. (km/gal)", format: "decimal" },
        { key: "kmDriven", header: "Km Recorridos", format: "integer" },
        { key: "logCount", header: "Núm. Registros", format: "integer" },
      ],
    }, "analisis_eficiencia_combustible", "Eficiencia");
  };

  return (
    <>
      <PageHeader
        title="Análisis de Eficiencia de Combustible"
        description="Promedio, mínimo y máximo de eficiencia (km/gal) por vehículo."
        icon={TrendingUp}
      />
      <div className="mb-4 flex flex-wrap md:flex-nowrap items-center gap-1.5 justify-end">
        <div className="min-w-[220px]">
          <VehicleMultiSelect
            vehicles={vehicles}
            selectedIds={selectedVehicleIds}
            onChange={setSelectedVehicleIds}
            buttonLabel="Vehículos"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start h-10">
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
        <div className="min-w-[220px]">
          <Select value={sortKey} onValueChange={setSortKey}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km_desc">Km recorridos (desc)</SelectItem>
              <SelectItem value="km_asc">Km recorridos (asc)</SelectItem>
              <SelectItem value="eff_desc">Eficiencia prom. (desc)</SelectItem>
              <SelectItem value="eff_asc">Eficiencia prom. (asc)</SelectItem>
              <SelectItem value="logs_desc">N° registros (desc)</SelectItem>
              <SelectItem value="logs_asc">N° registros (asc)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button variant="outline" onClick={handleExportCSV} disabled={filteredEfficiency.length === 0}>
          <FileDown className="mr-2 h-4 w-4" /> CSV
        </Button>
        <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={filteredEfficiency.length === 0}>
          <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
        </Button>
      </div>

      {/* KPIs de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="shadow-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eficiencia ponderada</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-semibold">{weightedEfficiency != null ? `${formatNumber(weightedEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal` : 'N/A'}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">Km recorridos</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-semibold">{formatNumber(totalKm)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">Galones consumidos</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-semibold">{formatNumber(totalGallons, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">Costo por km</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-semibold">{costPerKm != null ? `C$ ${formatNumber(costPerKm, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">
            {(() => {
              const total = vehicles.length;
              const selCount = selectedVehicleIds.length;
              let suffix = " (Todos los vehículos)";
              if (selCount === 1) {
                const vid = selectedVehicleIds[0];
                const veh = vehicles.find(v => v.id === vid) ||
                  // fallback: try from efficiency data
                  (filteredEfficiency.find(d => d.vehicleId === vid) ? { plateNumber: filteredEfficiency.find(d => d.vehicleId === vid)!.plateNumber } as any : undefined);
                suffix = veh ? ` para ${veh.plateNumber}` : "";
              } else if (selCount > 1 && selCount < total) {
                suffix = ` (Vehículos seleccionados: ${selCount})`;
              }
              return `Análisis de Eficiencia por Vehículo${suffix}`;
            })()}
          </CardTitle>
          <CardDescription>
            Promedio, mínimo y máximo de eficiencia de combustible (km/gal), filtrables por rango de fechas y vehículo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : sortedEfficiency.length === 0 ? (
            <p className="text-muted-foreground">No hay datos de eficiencia de combustible disponibles o registros de combustible con cálculo de eficiencia. Verifique la implementación de la base de datos y los registros existentes.</p>
          ) : (
            <Table className="text-base [&_th]:px-4 [&_th]:py-2 md:[&_th]:py-3 [&_td]:px-4 [&_td]:py-2 md:[&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Vehículo (Matrícula)</TableHead>
                  <TableHead className="font-semibold">Marca y Modelo</TableHead>
                  <TableHead className="text-right font-semibold">Eficiencia Prom. (km/gal)</TableHead>
                  <TableHead className="text-right font-semibold">Eficiencia Mín. (km/gal)</TableHead>
                  <TableHead className="text-right font-semibold">Eficiencia Máx. (km/gal)</TableHead>
                  <TableHead className="text-right font-semibold">Km Recorridos</TableHead>
                  <TableHead className="text-right font-semibold">Núm. Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEfficiency.map(data => (
                  <TableRow key={data.vehicleId}>
                    <TableCell className="font-medium">{data.plateNumber}</TableCell>
                    <TableCell>{data.brandModel}</TableCell>
                    <TableCell className="text-right">{data.averageEfficiency != null ? formatNumber(data.averageEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{data.minEfficiency != null ? formatNumber(data.minEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{data.maxEfficiency != null ? formatNumber(data.maxEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{kmByVehicle.get(data.vehicleId) != null ? formatNumber(kmByVehicle.get(data.vehicleId) as number) : 'N/A'}</TableCell>
                    <TableCell className="text-right">{data.logCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Insights automáticos */}
      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Insights del período</CardTitle>
          <CardDescription>Hallazgos rápidos a partir de la selección actual (vehículos y fechas).</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedEfficiency.length === 0 ? (
            <p className="text-muted-foreground">No hay datos suficientes para generar insights.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Top 3 en eficiencia</div>
                <ul className="space-y-1">
                  {topEfficiency.length === 0 ? <li className="text-muted-foreground">Sin datos</li> : topEfficiency.map(v => (
                    <li key={v.id} className="flex justify-between"><span>{v.name}</span><span className="tabular-nums">{formatNumber(v.eff, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Mayor recorrido con buena eficiencia</div>
                <ul className="space-y-1">
                  {highKmGoodEff.length === 0 ? <li className="text-muted-foreground">Sin datos</li> : highKmGoodEff.map(v => (
                    <li key={v.id} className="flex justify-between"><span>{v.name}</span><span className="tabular-nums">{formatNumber(v.km)} km · {formatNumber(v.eff, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Prioridad de revisión</div>
                <ul className="space-y-1">
                  {lowEffHighKm.length === 0 ? <li className="text-muted-foreground">Sin datos</li> : lowEffHighKm.map(v => (
                    <li key={v.id} className="flex justify-between"><span>{v.name}</span><span className="tabular-nums">{formatNumber(v.km)} km · {formatNumber(v.eff, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal</span></li>
                  ))}
                </ul>
                {effThreshold != null && kmThreshold != null && (
                  <p className="text-xs text-muted-foreground mt-2">Criterio: km ≥ promedio ({formatNumber(kmThreshold)}) y eficiencia {"<"} promedio ({formatNumber(effThreshold, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal).</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Comparación de Eficiencia por Vehículo</CardTitle>
          <CardDescription>Promedio, mínimo y máximo de eficiencia por vehículo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              avgEfficiency: { label: "Eficiencia Prom. (km/gal)", color: "hsl(var(--chart-1))" },
              minEfficiency: { label: "Mín (km/gal)", color: "hsl(var(--chart-2))" },
              maxEfficiency: { label: "Máx (km/gal)", color: "hsl(var(--chart-3))" },
            }}
            className="h-72 lg:h-80"
          >
            <ResponsiveContainer>
              <BarChart data={sortedEfficiency.map(d => ({ name: d.plateNumber, avgEfficiency: d.averageEfficiency ?? 0, minEfficiency: d.minEfficiency ?? 0, maxEfficiency: d.maxEfficiency ?? 0 }))} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis width={72} tickMargin={8} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any, name: any) => {
                  const label = name === 'avgEfficiency' ? 'Promedio' : name === 'minEfficiency' ? 'Mínimo' : name === 'maxEfficiency' ? 'Máximo' : String(name);
                  return `${label}: ${formatNumber(Number(value), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/gal`;
                }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="avgEfficiency" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
                <Bar dataKey="minEfficiency" fill="hsl(var(--chart-2))" radius={[6,6,0,0]} />
                <Bar dataKey="maxEfficiency" fill="hsl(var(--chart-3))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Dispersión: Eficiencia vs Km recorridos */}
      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Relación: Eficiencia vs Km Recorridos</CardTitle>
          <CardDescription>Visualiza qué vehículos mantienen buena eficiencia recorriendo mayores distancias en el período.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ point: { label: "Vehículo", color: "hsl(var(--chart-4))" } }}
            className="h-72 lg:h-80"
          >
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="km" name="Km recorridos" unit=" km" tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="eff" name="Eficiencia" unit=" km/gal" width={72} tickMargin={8} tickLine={false} axisLine={false} />
                {avgKmPerVehicle != null && <ReferenceLine x={avgKmPerVehicle} stroke="var(--muted-foreground)" strokeDasharray="3 3" />}
                {weightedEfficiency != null && <ReferenceLine y={weightedEfficiency} stroke="var(--muted-foreground)" strokeDasharray="3 3" />}
                <RechartsTooltip content={<ScatterTooltip />} />
                <Scatter
                  name="Vehículo"
                  data={sortedEfficiency.map(d => ({
                    name: d.plateNumber,
                    km: kmByVehicle.get(d.vehicleId) ?? 0,
                    eff: d.averageEfficiency ?? 0,
                  }))}
                  fill="hsl(var(--chart-4))"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
