
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

//

export default function ComparativeExpenseAnalysisPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<ComparativeExpenseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
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
        const params = new URLSearchParams();
        if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
        if (selectedVehicleId !== "all") params.set("vehicleId", selectedVehicleId);
        const res = await fetch(`/api/reports/comparative-expenses?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error cargando informe: ${res.status}`);
        const s = await res.json();
        setSummary(s);

        // Load monthly trend for the same filters (vehicle/date)
        const trendParams = new URLSearchParams();
        if (dateRange?.from) trendParams.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) trendParams.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
        if (selectedVehicleId !== "all") trendParams.set("vehicleId", selectedVehicleId);
        const resTrend = await fetch(`/api/reports/monthly-trend?${trendParams.toString()}`, { cache: "no-store" });
        if (resTrend.ok) {
          const tr = await resTrend.json();
          const mapped = (tr || []);
          setTrend(mapped.map((pt: any) => ({ label: pt.label, maintenance: Number(pt.maintenanceCost)||0, fueling: Number(pt.fuelingCost)||0 })));
          setTrendCostPerKm(mapped.map((pt: any) => ({ label: pt.label, costPerKm: pt.costPerKm != null ? Number(pt.costPerKm) : null })));
          setTrendEfficiency(mapped.map((pt: any) => ({ label: pt.label, avgEfficiency: pt.avgEfficiency != null ? Number(pt.avgEfficiency) : null })));
          setTrendKmDriven(mapped.map((pt: any) => ({ label: pt.label, kmDriven: pt.kmDriven != null ? Number(pt.kmDriven) : null })));
        } else {
          setTrend([]);
          setTrendCostPerKm([]);
          setTrendEfficiency([]);
          setTrendKmDriven([]);
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
  }, [selectedVehicleId, dateRange?.from, dateRange?.to]);

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

    if (selectedExpenseType === "all") return base;

    // Recalcular métricas según tipo seleccionado usando breakdown
    const filteredBreakdown = base.vehicleBreakdown.map(v => ({
      ...v,
      maintenanceCost: selectedExpenseType === "fueling" ? 0 : v.maintenanceCost,
      fuelingCost: selectedExpenseType === "maintenance" ? 0 : v.fuelingCost,
      totalCost: selectedExpenseType === "maintenance" ? v.maintenanceCost : selectedExpenseType === "fueling" ? v.fuelingCost : v.totalCost,
    }));

    const totalMaintenanceCost = filteredBreakdown.reduce((s, v) => s + v.maintenanceCost, 0);
    const totalFuelingCost = filteredBreakdown.reduce((s, v) => s + v.fuelingCost, 0);
    const totalOverallCost = totalMaintenanceCost + totalFuelingCost;
    const kmDrivenInPeriod = base.kmDrivenInPeriod;

    // Ajustes de galones y eficiencia para "solo mantenimiento"
    const totalGallonsConsumed = selectedExpenseType === "maintenance" ? 0 : base.totalGallonsConsumed;
    const maintenanceLogCount = selectedExpenseType === "fueling" ? 0 : base.maintenanceLogCount;
    const fuelingLogCount = selectedExpenseType === "maintenance" ? 0 : base.fuelingLogCount;

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
      vehicleBreakdown: filteredBreakdown,
    } as ComparativeExpenseSummary;
  }, [summary, selectedExpenseType]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (comparativeData.vehicleBreakdown.length === 0 && selectedVehicleId === "all") return;
    if (selectedVehicleId !== "all" && !comparativeData.vehicleBreakdown.find(v => v.vehicleId === selectedVehicleId)) return;
    
    let csvRows: string[] = [];
    const headers = ["Métrica", "Valor"];
    
    // General Summary
    csvRows.push("Resumen General");
    csvRows.push(headers.join(','));
    csvRows.push(`Costo Total Mantenimiento (C$),C$${comparativeData.totalMaintenanceCost.toFixed(2)}`);
    csvRows.push(`Costo Total Combustible (C$),C$${comparativeData.totalFuelingCost.toFixed(2)}`);
    csvRows.push(`Costo Total General (C$),C$${comparativeData.totalOverallCost.toFixed(2)}`);
    csvRows.push(`Galones Totales Consumidos,${comparativeData.totalGallonsConsumed.toFixed(2)}`);
    csvRows.push(`Kilómetros Recorridos,${comparativeData.kmDrivenInPeriod?.toLocaleString() ?? 'N/A'}`);
    csvRows.push(`Costo por Km (C$),${comparativeData.costPerKm ? 'C$' + comparativeData.costPerKm.toFixed(2) : 'N/A'}`);
    csvRows.push(`Eficiencia Prom. (km/gal),${comparativeData.avgFuelEfficiency ? comparativeData.avgFuelEfficiency.toFixed(1) : 'N/A'}`);
    csvRows.push(`Num. Registros Mantenimiento,${comparativeData.maintenanceLogCount}`);
    csvRows.push(`Num. Registros Combustible,${comparativeData.fuelingLogCount}`);
    csvRows.push(""); // Spacer

    // Vehicle Breakdown (if 'all' or specific vehicle has data)
    if (selectedVehicleId === "all" && comparativeData.vehicleBreakdown.length > 0) {
      csvRows.push("Desglose por Vehículo");
      const vehicleHeaders = ["Matrícula", "Marca y Modelo", "Costo Mantenimiento (C$)", "Costo Combustible (C$)", "Costo Total (C$)", "Km Recorridos"];
      csvRows.push(vehicleHeaders.join(','));
      comparativeData.vehicleBreakdown.forEach(v => {
        csvRows.push([
          v.plateNumber,
          v.brandModel,
          `C$${v.maintenanceCost.toFixed(2)}`,
          `C$${v.fuelingCost.toFixed(2)}`,
          `C$${v.totalCost.toFixed(2)}`,
          v.kmDriven?.toLocaleString() ?? 'N/A'
        ].join(','));
      });
    } else if (selectedVehicleId !== "all") {
        const vehicleData = comparativeData.vehicleBreakdown.find(v => v.vehicleId === selectedVehicleId);
        if (vehicleData) {
            csvRows.push(`Detalle Vehículo: ${vehicleData.plateNumber}`);
            csvRows.push(["Métrica", "Valor"].join(','));
            csvRows.push(`Costo Mantenimiento (C$),C$${vehicleData.maintenanceCost.toFixed(2)}`);
            csvRows.push(`Costo Combustible (C$),C$${vehicleData.fuelingCost.toFixed(2)}`);
            csvRows.push(`Costo Total (C$),C$${vehicleData.totalCost.toFixed(2)}`);
            csvRows.push(`Km Recorridos,${vehicleData.kmDriven?.toLocaleString() ?? 'N/A'}`);
        }
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
  
  const selectedVehicleInfo = selectedVehicleId !== "all" ? vehicles.find(v => v.id === selectedVehicleId) : null;

  return (
    <>
      <PageHeader
        title="Informe Comparativo de Gastos"
        description="Analiza y compara los gastos de mantenimiento y combustible de tu flota."
        icon={BarChartHorizontalBig}
        actions={
          <div className="page-header-actions flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV} disabled={isLoading || (!comparativeData.vehicleBreakdown.length && selectedVehicleId === 'all') }>
                <FileDown className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={isLoading || (!comparativeData.vehicleBreakdown.length && selectedVehicleId === 'all') }>
                <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
              </Button>
            </div>
          </div>
        }
      />

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Filter className="mr-2 h-5 w-5"/>Filtros del Informe</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="vehicle-select" className="text-sm font-medium">Vehículo</label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger id="vehicle-select">
                <SelectValue placeholder="Seleccionar vehículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vehículos</SelectItem>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plateNumber} ({v.brand} {v.model})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="expense-type-select" className="text-sm font-medium">Tipo de Gasto</label>
            <Select value={selectedExpenseType} onValueChange={setSelectedExpenseType}>
              <SelectTrigger id="expense-type-select">
                <SelectValue placeholder="Seleccionar tipo de gasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Gastos</SelectItem>
                <SelectItem value="maintenance">Solo Mantenimiento</SelectItem>
                <SelectItem value="fueling">Solo Combustible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
             <label htmlFor="date-range-picker" className="text-sm font-medium">Rango de Fechas</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-range-picker" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "LLL dd, y", { locale: es })} - ${format(dateRange.to, "LLL dd, y", { locale: es })}`
                    ) : (
                      format(dateRange.from, "LLL dd, y", { locale: es })
                    )
                  ) : (
                    <span>Seleccionar rango</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
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
        </CardContent>
      </Card>

      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">
            Resumen de Gastos 
            {selectedVehicleInfo ? ` para ${selectedVehicleInfo.plateNumber}` : selectedVehicleId === "all" ? " (Todos los Vehículos)" : ""}
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
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-sm font-medium">Costo Mantenimiento</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(comparativeData.totalMaintenanceCost)}</p></CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-sm font-medium">Costo Combustible</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(comparativeData.totalFuelingCost)}</p></CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground">
                <CardHeader><CardTitle className="text-sm font-medium">Costo Total General</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(comparativeData.totalOverallCost)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Galones Consumidos</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{formatNumber(comparativeData.totalGallonsConsumed, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Km Recorridos (Período)</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.kmDrivenInPeriod != null ? formatNumber(comparativeData.kmDrivenInPeriod) : 'N/A'}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Costo por Km (General)</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.costPerKm != null ? formatCurrency(comparativeData.costPerKm) : 'N/A'}</p></CardContent>
              </Card>
               <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Eficiencia Prom. (km/gal)</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.avgFuelEfficiency ? `${comparativeData.avgFuelEfficiency.toFixed(1)} km/gal` : 'N/A'}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium"># Mantenimientos</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.maintenanceLogCount}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium"># Cargas Combustible</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.fuelingLogCount}</p></CardContent>
              </Card>
            </div>
          )}

          {selectedVehicleId === "all" && !isLoading && comparativeData.vehicleBreakdown.length > 0 && (
            <>
              <h3 className="text-xl font-semibold my-4 text-primary">Desglose por Vehículo</h3>
              <Table className="text-base">
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
                  {comparativeData.vehicleBreakdown.filter(v => v.totalCost > 0 || v.kmDriven).map(v => (
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

