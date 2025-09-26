
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChartHorizontalBig, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import { formatCurrency, formatNumber, getCurrency, getLocale } from "@/lib/currency";
import type { Vehicle } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import type { ComparativeExpenseSummary } from "@/lib/actions/report-actions";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import SixMonthsCostChart from "@/components/six-months-cost-chart";
import MonthlyCostPerKmChart from "@/components/monthly-cost-per-km-chart";
import MonthlyEfficiencyChart from "@/components/monthly-efficiency-chart";
import MonthlyKmDrivenChart from "@/components/monthly-km-driven-chart";
import { exportToXLSX, exportMultipleSheetsToXLSX } from "@/lib/export-excel";
import { VehicleMultiSelect } from "@/components/vehicles/vehicle-multi-select";

//

export default function ComparativeExpenseAnalysisPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<ComparativeExpenseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: startOfMonth(today),
      to: endOfMonth(today),
    };
  });

  // Monthly trend data for charts
  const [trend, setTrend] = useState<{ label: string; maintenance: number; fueling: number }[]>([]);
  const [trendCostPerKm, setTrendCostPerKm] = useState<{ label: string; costPerKm: number | null }[]>([]);
  const [trendEfficiency, setTrendEfficiency] = useState<{ label: string; avgEfficiency: number | null }[]>([]);
  const [trendKmDriven, setTrendKmDriven] = useState<{ label: string; kmDriven: number | null }[]>([]);

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
    async function loadData() {
      setIsLoading(true);
      try {
        if (vehicles.length === 0) {
          const resV = await fetch("/api/vehicles/list", { cache: "no-store" });
          if (!resV.ok) throw new Error(`Error cargando vehículos: ${resV.status}`);
          const v = await resV.json();
          setVehicles(v);
        }

        // Always build date params
        const baseParams = new URLSearchParams();
        if (dateRange?.from) baseParams.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) baseParams.set("endDate", format(dateRange.to, "yyyy-MM-dd"));

        // Summary fetch and aggregation
        if (selectedVehicleIds.length === 0) {
          const res = await fetch(`/api/reports/comparative-expenses?${baseParams.toString()}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`Error cargando informe: ${res.status}`);
          const s = await res.json();
          setSummary(s);
        } else {
          // Fetch per-vehicle and aggregate
          const summaries = await Promise.all(
            selectedVehicleIds.map(async (vid) => {
              const params = new URLSearchParams(baseParams);
              params.set("vehicleId", vid);
              const r = await fetch(`/api/reports/comparative-expenses?${params.toString()}`, { cache: "no-store" });
              if (!r.ok) throw new Error(`Error cargando informe vehículo ${vid}: ${r.status}`);
              return r.json();
            })
          );
          // Aggregate totals and breakdown
          const aggregated = summaries.reduce((acc: any, s: any) => {
            acc.totalMaintenanceCost += Number(s.totalMaintenanceCost) || 0;
            acc.totalFuelingCost += Number(s.totalFuelingCost) || 0;
            acc.totalOverallCost += Number(s.totalOverallCost) || 0;
            acc.totalGallonsConsumed += Number(s.totalGallonsConsumed) || 0;
            acc.maintenanceLogCount += Number(s.maintenanceLogCount) || 0;
            acc.fuelingLogCount += Number(s.fuelingLogCount) || 0;
            acc.kmDrivenInPeriod = (acc.kmDrivenInPeriod || 0) + (s.kmDrivenInPeriod || 0);
            acc.vehicleBreakdown.push(...(s.vehicleBreakdown || []));
            return acc;
          }, {
            totalMaintenanceCost: 0,
            totalFuelingCost: 0,
            totalOverallCost: 0,
            totalGallonsConsumed: 0,
            maintenanceLogCount: 0,
            fuelingLogCount: 0,
            kmDrivenInPeriod: 0,
            costPerKm: null,
            avgFuelEfficiency: null,
            vehicleBreakdown: [] as any[],
          });
          aggregated.costPerKm = aggregated.kmDrivenInPeriod > 0 ? aggregated.totalOverallCost / aggregated.kmDrivenInPeriod : null;
          aggregated.avgFuelEfficiency = aggregated.totalGallonsConsumed > 0 ? aggregated.kmDrivenInPeriod / aggregated.totalGallonsConsumed : null;
          setSummary(aggregated);
        }

        // Monthly trend fetch and aggregation
        if (selectedVehicleIds.length === 0) {
          const resTrend = await fetch(`/api/reports/monthly-trend?${baseParams.toString()}`, { cache: "no-store" });
          if (resTrend.ok) {
            const tr = await resTrend.json();
            const mapped = tr || [];
            setTrend(mapped.map((pt: any) => ({ label: pt.label, maintenance: Number(pt.maintenanceCost) || 0, fueling: Number(pt.fuelingCost) || 0 })));
            setTrendCostPerKm(mapped.map((pt: any) => ({ label: pt.label, costPerKm: pt.costPerKm != null ? Number(pt.costPerKm) : null })));
            setTrendEfficiency(mapped.map((pt: any) => ({ label: pt.label, avgEfficiency: pt.avgEfficiency != null ? Number(pt.avgEfficiency) : null })));
            setTrendKmDriven(mapped.map((pt: any) => ({ label: pt.label, kmDriven: pt.kmDriven != null ? Number(pt.kmDriven) : null })));
          } else {
            setTrend([]);
            setTrendCostPerKm([]);
            setTrendEfficiency([]);
            setTrendKmDriven([]);
          }
        } else {
          const trends = await Promise.all(
            selectedVehicleIds.map(async (vid) => {
              const params = new URLSearchParams(baseParams);
              params.set("vehicleId", vid);
              const r = await fetch(`/api/reports/monthly-trend?${params.toString()}`, { cache: "no-store" });
              return r.ok ? r.json() : [];
            })
          );
          // Combine by label
          const byLabel: Record<string, { maintenance: number; fueling: number; kmDriven: number; avgEffValues: number[] }> = {};
          for (const tr of trends) {
            for (const pt of tr || []) {
              const label = pt.label as string;
              if (!byLabel[label]) byLabel[label] = { maintenance: 0, fueling: 0, kmDriven: 0, avgEffValues: [] };
              byLabel[label].maintenance += Number(pt.maintenanceCost) || 0;
              byLabel[label].fueling += Number(pt.fuelingCost) || 0;
              byLabel[label].kmDriven += pt.kmDriven != null ? Number(pt.kmDriven) : 0;
              if (pt.avgEfficiency != null) byLabel[label].avgEffValues.push(Number(pt.avgEfficiency));
            }
          }
          const labels = Object.keys(byLabel);
          labels.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          const trendCombined = labels.map(label => ({ label, maintenance: byLabel[label].maintenance, fueling: byLabel[label].fueling }));
          const costPerKmCombined = labels.map(label => {
            const totalCost = byLabel[label].maintenance + byLabel[label].fueling;
            const km = byLabel[label].kmDriven;
            return { label, costPerKm: km > 0 ? totalCost / km : null };
          });
          const efficiencyCombined = labels.map(label => {
            const vals = byLabel[label].avgEffValues;
            const avg = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : null;
            return { label, avgEfficiency: avg };
          });
          const kmCombined = labels.map(label => ({ label, kmDriven: byLabel[label].kmDriven || null }));
          setTrend(trendCombined);
          setTrendCostPerKm(costPerKmCombined);
          setTrendEfficiency(efficiencyCombined);
          setTrendKmDriven(kmCombined);
        }
      } catch (error) {
        console.error("Error loading comparative summary:", error);
        setSummary(null);
        setTrend([]);
        setTrendCostPerKm([]);
        setTrendEfficiency([]);
        setTrendKmDriven([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [selectedVehicleIds, dateRange?.from, dateRange?.to]);

  const comparativeData = useMemo(() => {
    const base: ComparativeExpenseSummary = summary ?? {
      totalMaintenanceCost: 0,
      totalFuelingCost: 0,
      totalOverallCost: 0,
      totalGallonsConsumed: 0,
      maintenanceLogCount: 0,
      fuelingLogCount: 0,
      kmDrivenInPeriod: null,
      costPerKm: null,
      avgFuelEfficiency: null,
      vehicleBreakdown: [],
    };
    // If selecting a subset of vehicles, filter breakdown to subset (summary totals are already aggregated in loadData for multi-select)
    const subsetSet = new Set(selectedVehicleIds);
    const baseFiltered = selectedVehicleIds.length === 0
      ? base
      : {
          ...base,
          vehicleBreakdown: base.vehicleBreakdown.filter(v => subsetSet.has(String(v.vehicleId))),
        };

    // Apply expense type filter to breakdown and recompute totals accordingly
    const adjustedBreakdown = baseFiltered.vehicleBreakdown.map(v => ({
      ...v,
      maintenanceCost: selectedExpenseType === "fueling" ? 0 : v.maintenanceCost,
      fuelingCost: selectedExpenseType === "maintenance" ? 0 : v.fuelingCost,
      totalCost: selectedExpenseType === "maintenance" ? v.maintenanceCost : selectedExpenseType === "fueling" ? v.fuelingCost : v.totalCost,
    }));

    const totalMaintenanceCost = adjustedBreakdown.reduce((s, v) => s + v.maintenanceCost, 0);
    const totalFuelingCost = adjustedBreakdown.reduce((s, v) => s + v.fuelingCost, 0);
    const totalOverallCost = totalMaintenanceCost + totalFuelingCost;
    const kmDrivenInPeriod = baseFiltered.kmDrivenInPeriod;

    const totalGallonsConsumed = selectedExpenseType === "maintenance" ? 0 : baseFiltered.totalGallonsConsumed;
    const maintenanceLogCount = selectedExpenseType === "fueling" ? 0 : baseFiltered.maintenanceLogCount;
    const fuelingLogCount = selectedExpenseType === "maintenance" ? 0 : baseFiltered.fuelingLogCount;

    const costPerKm = kmDrivenInPeriod && totalOverallCost > 0 ? totalOverallCost / kmDrivenInPeriod : null;
    const avgFuelEfficiency = kmDrivenInPeriod && totalGallonsConsumed > 0 ? kmDrivenInPeriod / totalGallonsConsumed : null;

    return {
      totalMaintenanceCost,
      totalFuelingCost,
      totalOverallCost,
      totalGallonsConsumed,
      maintenanceLogCount,
      fuelingLogCount,
      kmDrivenInPeriod,
      costPerKm,
      avgFuelEfficiency,
      vehicleBreakdown: adjustedBreakdown,
    } as ComparativeExpenseSummary;
  }, [summary, selectedExpenseType, selectedVehicleIds]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (comparativeData.vehicleBreakdown.length === 0 && selectedVehicleIds.length === 0) return;
    if (selectedVehicleIds.length === 1 && !comparativeData.vehicleBreakdown.find(v => v.vehicleId === selectedVehicleIds[0])) return;
    
    let csvRows: string[] = [];
    const headers = ["Métrica", "Valor"];
    
    // General Summary
    csvRows.push("Resumen General");
    csvRows.push(headers.join(','));
  csvRows.push(`Costo Total Mantenimiento (C$),${formatCurrency(comparativeData.totalMaintenanceCost)}`);
  csvRows.push(`Costo Total Combustible (C$),${formatCurrency(comparativeData.totalFuelingCost)}`);
  csvRows.push(`Costo Total General (C$),${formatCurrency(comparativeData.totalOverallCost)}`);
  csvRows.push(`Galones Totales Consumidos,${formatNumber(comparativeData.totalGallonsConsumed, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  csvRows.push(`Kilómetros Recorridos,${comparativeData.kmDrivenInPeriod != null ? formatNumber(comparativeData.kmDrivenInPeriod) : 'N/A'}`);
  csvRows.push(`Costo por Km (C$),${comparativeData.costPerKm != null ? formatCurrency(comparativeData.costPerKm) : 'N/A'}`);
  csvRows.push(`Eficiencia Prom. (km/gal),${comparativeData.avgFuelEfficiency != null ? formatNumber(comparativeData.avgFuelEfficiency, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'N/A'}`);
    csvRows.push(`Num. Registros Mantenimiento,${comparativeData.maintenanceLogCount}`);
    csvRows.push(`Num. Registros Combustible,${comparativeData.fuelingLogCount}`);
    csvRows.push(""); // Spacer

    // Vehicle Breakdown (if 'all' or multi-select subset)
    if (selectedVehicleIds.length === 0 && comparativeData.vehicleBreakdown.length > 0) {
      csvRows.push("Desglose por Vehículo");
      const vehicleHeaders = ["Matrícula", "Marca y Modelo", "Costo Mantenimiento (C$)", "Costo Combustible (C$)", "Costo Total (C$)", "Km Recorridos"]; 
      csvRows.push(vehicleHeaders.join(','));
      comparativeData.vehicleBreakdown.forEach(v => {
        csvRows.push([
          v.plateNumber,
          v.brandModel,
          formatCurrency(v.maintenanceCost),
          formatCurrency(v.fuelingCost),
          formatCurrency(v.totalCost),
          v.kmDriven != null ? formatNumber(v.kmDriven) : 'N/A'
        ].join(','));
      });
    } else if (selectedVehicleIds.length === 1) {
        const vehicleData = comparativeData.vehicleBreakdown.find(v => v.vehicleId === selectedVehicleIds[0]);
        if (vehicleData) {
            csvRows.push(`Detalle Vehículo: ${vehicleData.plateNumber}`);
      csvRows.push(["Métrica", "Valor"].join(','));
      csvRows.push(`Costo Mantenimiento (C$),${formatCurrency(vehicleData.maintenanceCost)}`);
      csvRows.push(`Costo Combustible (C$),${formatCurrency(vehicleData.fuelingCost)}`);
      csvRows.push(`Costo Total (C$),${formatCurrency(vehicleData.totalCost)}`);
      csvRows.push(`Km Recorridos,${vehicleData.kmDriven != null ? formatNumber(vehicleData.kmDriven) : 'N/A'}`);
        }
    } else if (selectedVehicleIds.length > 1) {
      const set = new Set(selectedVehicleIds);
      csvRows.push("Desglose por Vehículo (seleccionados)");
      const vehicleHeaders = ["Matrícula", "Marca y Modelo", "Costo Mantenimiento (C$)", "Costo Combustible (C$)", "Costo Total (C$)", "Km Recorridos"]; 
      csvRows.push(vehicleHeaders.join(','));
      comparativeData.vehicleBreakdown.filter(v => set.has(String(v.vehicleId))).forEach(v => {
        csvRows.push([
          v.plateNumber,
          v.brandModel,
          formatCurrency(v.maintenanceCost),
          formatCurrency(v.fuelingCost),
          formatCurrency(v.totalCost),
          v.kmDriven != null ? formatNumber(v.kmDriven) : 'N/A'
        ].join(','));
      });
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_comparativo_gastos.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXLSX = async () => {
    if (!comparativeData) return;
    const summaryRows = [
      { Metrica: "Costo Total Mantenimiento (C$)", Valor: Number(comparativeData.totalMaintenanceCost.toFixed(2)) },
      { Metrica: "Costo Total Combustible (C$)", Valor: Number(comparativeData.totalFuelingCost.toFixed(2)) },
      { Metrica: "Costo Total General (C$)", Valor: Number(comparativeData.totalOverallCost.toFixed(2)) },
      { Metrica: "Galones Totales Consumidos", Valor: Number(comparativeData.totalGallonsConsumed.toFixed(2)) },
      { Metrica: "Kilómetros Recorridos", Valor: comparativeData.kmDrivenInPeriod ?? null },
      { Metrica: "Costo por Km (C$)", Valor: comparativeData.costPerKm != null ? Number(comparativeData.costPerKm.toFixed(2)) : null },
      { Metrica: "Eficiencia Prom. (km/gal)", Valor: comparativeData.avgFuelEfficiency != null ? Number(comparativeData.avgFuelEfficiency.toFixed(1)) : null },
      { Metrica: "Num. Registros Mantenimiento", Valor: comparativeData.maintenanceLogCount },
      { Metrica: "Num. Registros Combustible", Valor: comparativeData.fuelingLogCount },
    ];
    const breakdownRows = comparativeData.vehicleBreakdown.map(v => ({
      Matrícula: v.plateNumber,
      "Marca y Modelo": v.brandModel,
      "Costo Mantenimiento (C$)": Number(v.maintenanceCost.toFixed(2)),
      "Costo Combustible (C$)": Number(v.fuelingCost.toFixed(2)),
      "Costo Total (C$)": Number(v.totalCost.toFixed(2)),
      "Km Recorridos": v.kmDriven ?? null,
    }));
    await exportMultipleSheetsToXLSX([
      { sheetName: "Resumen", rows: summaryRows },
      { sheetName: "Desglose", rows: breakdownRows },
    ], "informe_comparativo_gastos");
  };
  
  const selectedVehicleInfo = selectedVehicleIds.length === 1 ? vehicles.find(v => v.id === selectedVehicleIds[0]) : null;

  return (
    <>
      <PageHeader
        title="Informe Comparativo de Gastos"
        description="Analiza y compara los gastos de mantenimiento y combustible de tu flota."
        icon={BarChartHorizontalBig}
      />
      <div className="mb-4 flex flex-wrap md:flex-nowrap items-center gap-1.5 justify-end">
        <VehicleMultiSelect vehicles={vehicles} selectedIds={selectedVehicleIds} onChange={setSelectedVehicleIds} buttonLabel="Vehículos" />
        <div className="min-w-[220px]">
          <Select value={selectedExpenseType} onValueChange={setSelectedExpenseType}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de gasto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Gastos</SelectItem>
              <SelectItem value="maintenance">Solo Mantenimiento</SelectItem>
              <SelectItem value="fueling">Solo Combustible</SelectItem>
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
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button variant="outline" onClick={handleExportCSV} disabled={isLoading || (!comparativeData.vehicleBreakdown.length && selectedVehicleIds.length === 0) }>
          <FileDown className="mr-2 h-4 w-4" /> CSV
        </Button>
        <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={isLoading || (!comparativeData.vehicleBreakdown.length && selectedVehicleIds.length === 0) }>
          <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
        </Button>
      </div>


      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">
            Resumen de Gastos 
            {selectedVehicleInfo
              ? ` para ${selectedVehicleInfo.plateNumber}`
              : selectedVehicleIds.length === 0
                ? " (Todos los vehículos)"
                : ` (Vehículos seleccionados: ${selectedVehicleIds.length})`}
            {dateRange?.from && dateRange?.to ? ` (${format(dateRange.from, "P", {locale:es})} - ${format(dateRange.to, "P", {locale:es})})` : ""}
          </CardTitle>
          <CardDescription>
            Costos consolidados según los filtros aplicados.
            {isLoading && " Cargando datos..."}
            {!isLoading && comparativeData.vehicleBreakdown.length === 0 && " No hay datos para los filtros seleccionados o la BD no está conectada."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Card className="bg-muted/30 h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Costo Mantenimiento</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-2xl font-bold">{formatCurrency(comparativeData.totalMaintenanceCost)}</p></CardContent>
              </Card>
              <Card className="bg-muted/30 h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Costo Combustible</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-2xl font-bold">{formatCurrency(comparativeData.totalFuelingCost)}</p></CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-primary-foreground">Costo Total General</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-2xl font-bold">{formatCurrency(comparativeData.totalOverallCost)}</p></CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Galones Consumidos</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-xl">{formatNumber(comparativeData.totalGallonsConsumed, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</p></CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Km Recorridos (Período)</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-xl">{comparativeData.kmDrivenInPeriod != null ? formatNumber(comparativeData.kmDrivenInPeriod) : 'N/A'}</p></CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Costo por Km (General)</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-xl">{comparativeData.costPerKm != null ? formatCurrency(comparativeData.costPerKm) : 'N/A'}</p></CardContent>
              </Card>
               <Card className="h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Eficiencia Prom. (km/gal)</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-xl">{comparativeData.avgFuelEfficiency ? `${comparativeData.avgFuelEfficiency.toFixed(1)} km/gal` : 'N/A'}</p></CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground"># Mantenimientos</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-xl">{comparativeData.maintenanceLogCount}</p></CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="items-center text-center"><CardTitle className="text-sm font-medium text-muted-foreground"># Cargas Combustible</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center text-center gap-1"><p className="text-xl">{comparativeData.fuelingLogCount}</p></CardContent>
              </Card>
            </div>
          )}

          {(selectedVehicleIds.length === 0 || selectedVehicleIds.length > 1) && !isLoading && comparativeData.vehicleBreakdown.length > 0 && (
            <>
              <h3 className="text-xl font-semibold my-4 text-primary">
                Desglose por Vehículo{selectedVehicleIds.length > 1 ? " (seleccionados)" : ""}
              </h3>
              <Table className="text-base [&_th]:px-4 [&_th]:py-2 md:[&_th]:py-3 [&_td]:px-4 [&_td]:py-2 md:[&_td]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Matrícula</TableHead>
                    <TableHead className="font-semibold">Marca y Modelo</TableHead>
                    <TableHead className="text-right font-semibold">Costo Mantenimiento (C$)</TableHead>
                    <TableHead className="text-right font-semibold">Costo Combustible (C$)</TableHead>
                    <TableHead className="text-right font-semibold">Costo Total (C$)</TableHead>
                    <TableHead className="text-right font-semibold">Km Recorridos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativeData.vehicleBreakdown
                    .filter(v => (selectedVehicleIds.length === 0 || selectedVehicleIds.includes(String(v.vehicleId))) && (v.totalCost > 0 || v.kmDriven))
                    .map(v => (
                    <TableRow key={v.vehicleId}>
                      <TableCell>{v.plateNumber}</TableCell>
                      <TableCell>{v.brandModel}</TableCell>
                      <TableCell className="text-right">{formatCurrency(v.maintenanceCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(v.fuelingCost)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(v.totalCost)}</TableCell>
                      <TableCell className="text-right">{v.kmDriven != null ? formatNumber(v.kmDriven) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-lg printable-area">
        <CardHeader>
          <CardTitle>Gastos por Mes</CardTitle>
          <CardDescription>Tendencia mensual de mantenimiento y combustible según filtros.</CardDescription>
        </CardHeader>
        <CardContent>
          <SixMonthsCostChart data={trend} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="shadow-lg printable-area">
          <CardHeader>
            <CardTitle>Costo por Km (Mensual)</CardTitle>
            <CardDescription>Relación de costo total sobre kilómetros recorridos por mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyCostPerKmChart data={trendCostPerKm} />
          </CardContent>
        </Card>

        <Card className="shadow-lg printable-area">
          <CardHeader>
            <CardTitle>Eficiencia (km/gal) Mensual</CardTitle>
            <CardDescription>Promedio mensual de eficiencia de combustible.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyEfficiencyChart data={trendEfficiency} />
          </CardContent>
        </Card>

        <Card className="shadow-lg printable-area">
          <CardHeader>
            <CardTitle>Kilómetros Recorridos (Mensual)</CardTitle>
            <CardDescription>Estimación mensual de km recorridos a partir de registros.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyKmDrivenChart data={trendKmDriven} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

