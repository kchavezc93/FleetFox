"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { TrendingUp, CalendarDays, FileDown, Printer } from "lucide-react";
import type { Vehicle } from "@/types";
import type { PeriodOverPeriodSummary, PeriodOverPeriodRow } from "@/lib/actions/report-actions";
import { useEffect, useMemo, useState } from "react";

function formatPct(p: number | null | undefined) {
  if (p == null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function formatCurrency(n: number) {
  return `C$${n.toFixed(2)}`;
}

export default function PeriodOverPeriodReportPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });
  const [data, setData] = useState<PeriodOverPeriodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        const prev = subMonths(startOfMonth(today), 1);
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
    async function load() {
      setIsLoading(true);
      try {
        if (vehicles.length === 0) {
          const resV = await fetch("/api/vehicles/list", { cache: "no-store" });
          const v = await resV.json();
          setVehicles(v);
        }
        const params = new URLSearchParams();
        if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
        if (selectedVehicleId !== "all") params.set("vehicleId", selectedVehicleId);
        const res = await fetch(`/api/reports/period-over-period?${params.toString()}`, { cache: "no-store" });
        const json: PeriodOverPeriodSummary = await res.json();
        setData(json);
      } catch (e) {
        console.error("Error loading PoP report", e);
        setData({ rows: [], totals: {
          currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
          prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
          deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0,
          pctFuelCost: null, pctMaintenanceCost: null, pctOverallCost: null, pctGallons: null,
        }, meta: { startDate: null, endDate: null, prevStartDate: null, prevEndDate: null } });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [selectedVehicleId, dateRange?.from, dateRange?.to]);

  const rows: PeriodOverPeriodRow[] = useMemo(() => data?.rows ?? [], [data]);
  const totals = data?.totals;
  const meta = data?.meta;

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = [
      "Vehículo",
      "Actual Costo (C$)",
      "Anterior Costo (C$)",
      "Δ Costo (C$)",
      "% Costo",
      "Actual Galones",
      "Anterior Galones",
      "Δ Galones",
      "% Galones",
    ];
    const csv = [headers.join(","), ...rows.map(r => [
      `${r.plateNumber} (${r.brandModel})`,
      r.currentOverallCost.toFixed(2),
      r.prevOverallCost.toFixed(2),
      r.deltaOverallCost.toFixed(2),
      r.pctOverallCost == null ? "" : (r.pctOverallCost * 100).toFixed(1) + "%",
      r.currentGallons.toFixed(2),
      r.prevGallons.toFixed(2),
      r.deltaGallons.toFixed(2),
      r.pctGallons == null ? "" : (r.pctGallons * 100).toFixed(1) + "%",
    ].join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'informe_periodo_vs_periodo.csv';
    a.click();
  };

  return (
    <>
      <PageHeader
        title="Análisis Período vs Período"
        description="Compara costos y consumo del período seleccionado contra el período anterior equivalente."
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
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportCSV} disabled={!rows.length}>
              <FileDown className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">Resumen</CardTitle>
          <div className="mt-1 text-base">
            {meta?.startDate && meta?.endDate ? (
              <div className="space-y-1">
                <div>
                  <span className="font-semibold">Período anterior:</span>{" "}
                  <span>{meta.prevStartDate ?? "—"} a {meta.prevEndDate ?? "—"}</span>
                </div>
                <div>
                  <span className="font-semibold">Período actual:</span>{" "}
                  <span>{meta.startDate} a {meta.endDate}</span>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                Seleccione un rango de fechas para comparar con el período inmediatamente anterior.
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : !rows.length ? (
            <p className="text-muted-foreground">No hay datos para comparar con los filtros actuales.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Vehículo</TableHead>
                    <TableHead className="text-right font-semibold">Costo Anterior</TableHead>
                    <TableHead className="text-right font-semibold">Costo Actual</TableHead>
                    <TableHead className="text-right font-semibold">Δ Costo</TableHead>
                    <TableHead className="text-right font-semibold">% Costo</TableHead>
                    <TableHead className="text-right font-semibold">Galones Ant.</TableHead>
                    <TableHead className="text-right font-semibold">Galones Act.</TableHead>
                    <TableHead className="text-right font-semibold">Δ Galones</TableHead>
                    <TableHead className="text-right font-semibold">% Galones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.vehicleId}>
                      <TableCell className="font-medium">{r.plateNumber}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.prevOverallCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.currentOverallCost)}</TableCell>
                      <TableCell className={`text-right ${r.deltaOverallCost > 0 ? 'text-red-600' : r.deltaOverallCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaOverallCost)}</TableCell>
                      <TableCell className="text-right">{formatPct(r.pctOverallCost)}</TableCell>
                      <TableCell className="text-right">{r.prevGallons.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{r.currentGallons.toFixed(2)}</TableCell>
                      <TableCell className={`text-right ${r.deltaGallons > 0 ? 'text-red-600' : r.deltaGallons < 0 ? 'text-green-600' : ''}`}>{r.deltaGallons.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatPct(r.pctGallons)}</TableCell>
                    </TableRow>
                  ))}
                  {totals && (
                    <TableRow>
                      <TableCell className="font-bold">Totales</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totals.prevOverallCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totals.currentOverallCost)}</TableCell>
                      <TableCell className={`text-right font-bold ${totals.deltaOverallCost > 0 ? 'text-red-700' : totals.deltaOverallCost < 0 ? 'text-green-700' : ''}`}>{formatCurrency(totals.deltaOverallCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPct(totals.pctOverallCost)}</TableCell>
                      <TableCell className="text-right font-bold">{totals.prevGallons.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">{totals.currentGallons.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-bold ${totals.deltaGallons > 0 ? 'text-red-700' : totals.deltaGallons < 0 ? 'text-green-700' : ''}`}>{totals.deltaGallons.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPct(totals.pctGallons)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
