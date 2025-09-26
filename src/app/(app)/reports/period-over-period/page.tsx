"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import { TrendingUp, CalendarDays, FileDown, Printer, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Vehicle } from "@/types";
import type { PeriodOverPeriodSummary, PeriodOverPeriodRow } from "@/lib/actions/report-actions";
import { useEffect, useMemo, useState } from "react";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatCurrency as fmtCurrency, formatNumber } from "@/lib/currency";
import { VehicleMultiSelect } from "@/components/vehicles/vehicle-multi-select";

function formatPct(p: number | null | undefined) {
  if (p == null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

// Use centralized currency/number formatters
const formatCurrency = (n: number) => fmtCurrency(Number(n) || 0);

export default function PeriodOverPeriodReportPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });
  const [data, setData] = useState<PeriodOverPeriodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [compactView, setCompactView] = useState<boolean>(true);

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

        const baseParams = new URLSearchParams();
        if (dateRange?.from) baseParams.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to) baseParams.set("endDate", format(dateRange.to, "yyyy-MM-dd"));

        if (selectedVehicleIds.length === 0) {
          // All vehicles (server aggregates)
          const res = await fetch(`/api/reports/period-over-period?${baseParams.toString()}`, { cache: "no-store" });
          const json: PeriodOverPeriodSummary = await res.json();
          setData(json);
        } else if (selectedVehicleIds.length === 1) {
          // Single vehicle passthrough
          const params = new URLSearchParams(baseParams);
          params.set("vehicleId", selectedVehicleIds[0]);
          const res = await fetch(`/api/reports/period-over-period?${params.toString()}`, { cache: "no-store" });
          const json: PeriodOverPeriodSummary = await res.json();
          setData(json);
        } else {
          // Multi-select: fetch per vehicle and aggregate rows; compute totals from rows
          const results: PeriodOverPeriodSummary[] = await Promise.all(
            selectedVehicleIds.map(async (vid) => {
              const params = new URLSearchParams(baseParams);
              params.set("vehicleId", vid);
              const r = await fetch(`/api/reports/period-over-period?${params.toString()}`, { cache: "no-store" });
              return r.json();
            })
          );
          const rows = results.flatMap(r => r.rows || []);
          const acc = rows.reduce((a, r) => {
            a.currentFuelCost += r.currentFuelCost;
            a.currentMaintenanceCost += r.currentMaintenanceCost;
            a.currentOverallCost += r.currentOverallCost;
            a.currentGallons += r.currentGallons;
            a.prevFuelCost += r.prevFuelCost;
            a.prevMaintenanceCost += r.prevMaintenanceCost;
            a.prevOverallCost += r.prevOverallCost;
            a.prevGallons += r.prevGallons;
            a.deltaFuelCost += r.deltaFuelCost;
            a.deltaMaintenanceCost += r.deltaMaintenanceCost;
            a.deltaOverallCost += r.deltaOverallCost;
            a.deltaGallons += r.deltaGallons;
            return a;
          }, {
            currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
            prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
            deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0,
            pctFuelCost: null as number | null, pctMaintenanceCost: null as number | null, pctOverallCost: null as number | null, pctGallons: null as number | null,
          });
          const pct = (cur: number, prev: number) => (prev === 0 ? null : (cur / prev) - 1);
          const totals = {
            ...acc,
            pctFuelCost: pct(acc.currentFuelCost, acc.prevFuelCost),
            pctMaintenanceCost: pct(acc.currentMaintenanceCost, acc.prevMaintenanceCost),
            pctOverallCost: pct(acc.currentOverallCost, acc.prevOverallCost),
            pctGallons: pct(acc.currentGallons, acc.prevGallons),
          };
          const meta = results[0]?.meta ?? { startDate: null, endDate: null, prevStartDate: null, prevEndDate: null };
          setData({ rows, totals, meta });
        }
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
  }, [selectedVehicleIds, dateRange?.from, dateRange?.to]);

  const rows: PeriodOverPeriodRow[] = useMemo(() => data?.rows ?? [], [data]);
  // Client-side quick search by vehicle plate or brand/model
  const filteredRows: PeriodOverPeriodRow[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.plateNumber?.toLowerCase().includes(q) ||
      r.brandModel?.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);
  // Totals reflecting filtered rows (fallback to server totals if no filter)
  const totals = useMemo(() => {
    if (!data?.totals) return undefined;
    const src = searchQuery.trim() ? filteredRows : rows;
    if (!src.length) return { ...data.totals };
    const acc = src.reduce((a, r) => {
      a.currentFuelCost += r.currentFuelCost;
      a.currentMaintenanceCost += r.currentMaintenanceCost;
      a.currentOverallCost += r.currentOverallCost;
      a.currentGallons += r.currentGallons;
      a.prevFuelCost += r.prevFuelCost;
      a.prevMaintenanceCost += r.prevMaintenanceCost;
      a.prevOverallCost += r.prevOverallCost;
      a.prevGallons += r.prevGallons;
      a.deltaFuelCost += r.deltaFuelCost;
      a.deltaMaintenanceCost += r.deltaMaintenanceCost;
      a.deltaOverallCost += r.deltaOverallCost;
      a.deltaGallons += r.deltaGallons;
      return a;
    }, {
      currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
      prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
      deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0,
      pctFuelCost: null as number | null, pctMaintenanceCost: null as number | null, pctOverallCost: null as number | null, pctGallons: null as number | null,
    });
    const pct = (cur: number, prev: number) => (prev === 0 ? null : (cur / prev) - 1);
    return {
      ...acc,
      pctFuelCost: pct(acc.currentFuelCost, acc.prevFuelCost),
      pctMaintenanceCost: pct(acc.currentMaintenanceCost, acc.prevMaintenanceCost),
      pctOverallCost: pct(acc.currentOverallCost, acc.prevOverallCost),
      pctGallons: pct(acc.currentGallons, acc.prevGallons),
    };
  }, [data?.totals, filteredRows, rows, searchQuery]);
  const meta = data?.meta;

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = [
      "Vehículo",
      // Fuel costs
      "Combustible Ant. (C$)",
      "Combustible Act. (C$)",
      "Δ Combustible (C$)",
      "% Combustible",
      // Maintenance costs
      "Mantenimiento Ant. (C$)",
      "Mantenimiento Act. (C$)",
      "Δ Mantenimiento (C$)",
      "% Mantenimiento",
      // Overall costs
      "Costo Anterior (C$)",
      "Costo Actual (C$)",
      "Δ Costo (C$)",
      "% Costo",
      "Actual Galones",
      "Anterior Galones",
      "Δ Galones",
      "% Galones",
    ];
    const csv = [headers.join(","), ...rows.map(r => [
      `${r.plateNumber} (${r.brandModel})`,
      // Fuel
      r.prevFuelCost.toFixed(2),
      r.currentFuelCost.toFixed(2),
      r.deltaFuelCost.toFixed(2),
      r.pctFuelCost == null ? "" : (r.pctFuelCost * 100).toFixed(1) + "%",
      // Maintenance
      r.prevMaintenanceCost.toFixed(2),
      r.currentMaintenanceCost.toFixed(2),
      r.deltaMaintenanceCost.toFixed(2),
      r.pctMaintenanceCost == null ? "" : (r.pctMaintenanceCost * 100).toFixed(1) + "%",
      // Overall
      r.prevOverallCost.toFixed(2),
      r.currentOverallCost.toFixed(2),
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
      />

      {/* Single-line toolbar */}
      <div className="mb-4 flex flex-wrap md:flex-nowrap items-center gap-1.5 justify-end">
        <VehicleMultiSelect vehicles={vehicles} selectedIds={selectedVehicleIds} onChange={setSelectedVehicleIds} buttonLabel="Vehículos" />
        <div className="w-[220px]">
          <Input
            placeholder="Buscar placa o modelo"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Compacta</span>
          <Switch checked={compactView} onCheckedChange={setCompactView} />
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportCSV} disabled={!rows.length}>
          <FileDown className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Nota: El gráfico de totales se renderiza después de la tabla para mantener la convención: gráficos debajo de las tablas. */}

      <Card className="shadow-lg printable-area">
        <CardHeader className="items-start text-left">
          <CardTitle className="text-2xl">
            Resumen
            {selectedVehicleIds.length === 1
              ? (() => {
                  const v = vehicles.find(vv => vv.id === selectedVehicleIds[0]);
                  return v ? ` para ${v.plateNumber}` : "";
                })()
              : selectedVehicleIds.length === 0
                ? " (Todos los vehículos)"
                : ` (Vehículos seleccionados: ${selectedVehicleIds.length})`}
          </CardTitle>
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
          ) : compactView ? (
            // Compact accordion view per vehicle
            <div className="divide-y rounded-md border">
              <Accordion type="single" collapsible>
                {filteredRows.map(r => (
                  <AccordionItem key={r.vehicleId} value={r.vehicleId}>
                    <AccordionTrigger className="px-4 py-3 md:px-5 md:py-3">
                      <div className="grid w-full grid-cols-6 items-center gap-3 text-left text-sm md:text-base">
                        <div className="col-span-2">
                          <div className="font-semibold leading-tight">{r.plateNumber}</div>
                          <div className="text-xs md:text-sm text-muted-foreground leading-tight">{r.brandModel}</div>
                        </div>
                        <div className="text-right px-2 md:px-4">
                          <div className="text-[10px] md:text-xs text-muted-foreground">Total Ant.</div>
                          <div className="font-medium">{formatCurrency(r.prevOverallCost)}</div>
                        </div>
                        <div className="text-right px-2 md:px-4">
                          <div className="text-[10px] md:text-xs text-muted-foreground">Total Act.</div>
                          <div className="font-medium">{formatCurrency(r.currentOverallCost)}</div>
                        </div>
                        <div className={`text-right px-2 md:px-4 ${r.deltaOverallCost > 0 ? 'text-red-600' : r.deltaOverallCost < 0 ? 'text-green-600' : ''}`}>
                          <div className="text-[10px] md:text-xs text-muted-foreground">Δ Total</div>
                          <div className="font-medium">{formatCurrency(r.deltaOverallCost)}</div>
                        </div>
                        <div className={`text-right px-2 md:px-4 ${r.pctOverallCost != null ? (r.pctOverallCost > 0 ? 'text-red-600' : r.pctOverallCost < 0 ? 'text-green-600' : '') : ''}`}>
                          <div className="text-[10px] md:text-xs text-muted-foreground">% Total</div>
                          <div className="font-medium inline-flex items-center justify-end gap-1">
                            {r.pctOverallCost == null ? null : r.pctOverallCost > 0 ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : r.pctOverallCost < 0 ? (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            ) : (
                              <span className="inline-block h-3.5 w-3.5" />
                            )}
                            <span>{formatPct(r.pctOverallCost)}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <Table className="text-sm md:text-base [&_th]:px-4 [&_th]:py-2 md:[&_th]:py-3 [&_td]:px-4 [&_td]:py-2 md:[&_td]:py-3">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-center">Concepto</TableHead>
                              <TableHead className="text-center"><div>Valor</div><div className="text-xs text-muted-foreground">Anterior</div></TableHead>
                              <TableHead className="text-center"><div>Valor</div><div className="text-xs text-muted-foreground">Actual</div></TableHead>
                              <TableHead className="text-center"><div>Diferencia</div></TableHead>
                              <TableHead className="text-center"><div>Porcentaje</div></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium">Combustible</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.prevFuelCost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.currentFuelCost)}</TableCell>
                              <TableCell className={`text-right ${r.deltaFuelCost > 0 ? 'text-red-600' : r.deltaFuelCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaFuelCost)}</TableCell>
                              <TableCell className="text-right">{formatPct(r.pctFuelCost)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Mantenimiento</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.prevMaintenanceCost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.currentMaintenanceCost)}</TableCell>
                              <TableCell className={`text-right ${r.deltaMaintenanceCost > 0 ? 'text-red-600' : r.deltaMaintenanceCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaMaintenanceCost)}</TableCell>
                              <TableCell className="text-right">{formatPct(r.pctMaintenanceCost)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Total</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.prevOverallCost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.currentOverallCost)}</TableCell>
                              <TableCell className={`text-right ${r.deltaOverallCost > 0 ? 'text-red-600' : r.deltaOverallCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaOverallCost)}</TableCell>
                              <TableCell className="text-right">{formatPct(r.pctOverallCost)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Galones</TableCell>
                              <TableCell className="text-right">{formatNumber(r.prevGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{formatNumber(r.currentGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className={`text-right ${r.deltaGallons > 0 ? 'text-red-600' : r.deltaGallons < 0 ? 'text-green-600' : ''}`}>{formatNumber(r.deltaGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{formatPct(r.pctGallons)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {totals && (
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 px-4 py-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Combustible Ant.</div>
                    <div className="font-semibold">{formatCurrency(totals.prevFuelCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Combustible Act.</div>
                    <div className="font-semibold">{formatCurrency(totals.currentFuelCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Mant. Ant.</div>
                    <div className="font-semibold">{formatCurrency(totals.prevMaintenanceCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Mant. Act.</div>
                    <div className="font-semibold">{formatCurrency(totals.currentMaintenanceCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Ant.</div>
                    <div className="font-semibold">{formatCurrency(totals.prevOverallCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Act.</div>
                    <div className="font-semibold">{formatCurrency(totals.currentOverallCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Δ Total</div>
                    <div className={`font-semibold ${totals.deltaOverallCost > 0 ? 'text-red-700' : totals.deltaOverallCost < 0 ? 'text-green-700' : ''}`}>{formatCurrency(totals.deltaOverallCost)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">% Total</div>
                    <div className="font-semibold">{formatPct(totals.pctOverallCost)}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Detailed original table
            <div className="overflow-x-auto">
              <Table className="text-base [&_thead_th]:px-4 [&_thead_th]:py-2 md:[&_thead_th]:py-3 [&_tbody_td]:px-4 [&_tbody_td]:py-2 md:[&_tbody_td]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-center">Vehículo</TableHead>
                    {/* Fuel costs */}
                    <TableHead className="text-center font-semibold"><div>Combustible</div><div className="text-xs text-muted-foreground">Anterior</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Combustible</div><div className="text-xs text-muted-foreground">Actual</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Combustible</div><div className="text-xs text-muted-foreground">Diferencia</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Combustible</div><div className="text-xs text-muted-foreground">Porcentaje</div></TableHead>
                    {/* Maintenance costs */}
                    <TableHead className="text-center font-semibold"><div>Mantenimiento</div><div className="text-xs text-muted-foreground">Anterior</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Mantenimiento</div><div className="text-xs text-muted-foreground">Actual</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Mantenimiento</div><div className="text-xs text-muted-foreground">Diferencia</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Mantenimiento</div><div className="text-xs text-muted-foreground">Porcentaje</div></TableHead>
                    {/* Overall costs */}
                    <TableHead className="text-center font-semibold"><div>Total</div><div className="text-xs text-muted-foreground">Anterior</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Total</div><div className="text-xs text-muted-foreground">Actual</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Total</div><div className="text-xs text-muted-foreground">Diferencia</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Total</div><div className="text-xs text-muted-foreground">Porcentaje</div></TableHead>
                    {/* Gallons */}
                    <TableHead className="text-center font-semibold"><div>Galones</div><div className="text-xs text-muted-foreground">Anterior</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Galones</div><div className="text-xs text-muted-foreground">Actual</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Galones</div><div className="text-xs text-muted-foreground">Diferencia</div></TableHead>
                    <TableHead className="text-center font-semibold"><div>Galones</div><div className="text-xs text-muted-foreground">Porcentaje</div></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(r => (
                    <TableRow key={r.vehicleId}>
                      <TableCell className="font-medium px-4 py-3 align-top">
                        <div className="font-semibold leading-tight">{r.plateNumber}</div>
                        <div className="text-sm text-muted-foreground leading-tight">{r.brandModel}</div>
                      </TableCell>
                      {/* Fuel */}
                      <TableCell className="text-right px-4 py-3">{formatCurrency(r.prevFuelCost)}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatCurrency(r.currentFuelCost)}</TableCell>
                      <TableCell className={`text-right px-4 py-3 ${r.deltaFuelCost > 0 ? 'text-red-600' : r.deltaFuelCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaFuelCost)}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatPct(r.pctFuelCost)}</TableCell>
                      {/* Maintenance */}
                      <TableCell className="text-right px-4 py-3">{formatCurrency(r.prevMaintenanceCost)}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatCurrency(r.currentMaintenanceCost)}</TableCell>
                      <TableCell className={`text-right px-4 py-3 ${r.deltaMaintenanceCost > 0 ? 'text-red-600' : r.deltaMaintenanceCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaMaintenanceCost)}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatPct(r.pctMaintenanceCost)}</TableCell>
                      {/* Overall */}
                      <TableCell className="text-right px-4 py-3">{formatCurrency(r.prevOverallCost)}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatCurrency(r.currentOverallCost)}</TableCell>
                      <TableCell className={`text-right px-4 py-3 ${r.deltaOverallCost > 0 ? 'text-red-600' : r.deltaOverallCost < 0 ? 'text-green-600' : ''}`}>{formatCurrency(r.deltaOverallCost)}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatPct(r.pctOverallCost)}</TableCell>
                      {/* Gallons */}
                      <TableCell className="text-right px-4 py-3">{formatNumber(r.prevGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatNumber(r.currentGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right px-4 py-3 ${r.deltaGallons > 0 ? 'text-red-600' : r.deltaGallons < 0 ? 'text-green-600' : ''}`}>{formatNumber(r.deltaGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right px-4 py-3">{formatPct(r.pctGallons)}</TableCell>
                    </TableRow>
                  ))}
                  {totals && (
                    <TableRow>
                      <TableCell className="font-bold">Totales</TableCell>
                      {/* Fuel totals */}
                      <TableCell className="text-right font-bold">{formatCurrency(totals.prevFuelCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totals.currentFuelCost)}</TableCell>
                      <TableCell className={`text-right font-bold ${totals.deltaFuelCost > 0 ? 'text-red-700' : totals.deltaFuelCost < 0 ? 'text-green-700' : ''}`}>{formatCurrency(totals.deltaFuelCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPct(totals.pctFuelCost)}</TableCell>
                      {/* Maintenance totals */}
                      <TableCell className="text-right font-bold">{formatCurrency(totals.prevMaintenanceCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totals.currentMaintenanceCost)}</TableCell>
                      <TableCell className={`text-right font-bold ${totals.deltaMaintenanceCost > 0 ? 'text-red-700' : totals.deltaMaintenanceCost < 0 ? 'text-green-700' : ''}`}>{formatCurrency(totals.deltaMaintenanceCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPct(totals.pctMaintenanceCost)}</TableCell>
                      {/* Overall totals */}
                      <TableCell className="text-right font-bold">{formatCurrency(totals.prevOverallCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totals.currentOverallCost)}</TableCell>
                      <TableCell className={`text-right font-bold ${totals.deltaOverallCost > 0 ? 'text-red-700' : totals.deltaOverallCost < 0 ? 'text-green-700' : ''}`}>{formatCurrency(totals.deltaOverallCost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPct(totals.pctOverallCost)}</TableCell>
                      {/* Gallons totals */}
                      <TableCell className="text-right font-bold">{formatNumber(totals.prevGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold">{formatNumber(totals.currentGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right font-bold ${totals.deltaGallons > 0 ? 'text-red-700' : totals.deltaGallons < 0 ? 'text-green-700' : ''}`}>{formatNumber(totals.deltaGallons, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold">{formatPct(totals.pctGallons)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visual comparison card moved below tables: totals (Actual vs Anterior) for Combustible, Mantenimiento y Total */}
      {filteredRows.length > 0 && totals && (
        <Card className="mt-6 shadow-lg printable-area">
          <CardHeader>
            <CardTitle>Comparación visual (Totales)</CardTitle>
            <CardDescription>Actual vs anterior por concepto.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                prev: { label: "Anterior", color: "hsl(var(--chart-2))" },
                current: { label: "Actual", color: "hsl(var(--chart-1))" },
              }}
              className="h-64 lg:h-72"
            >
              <ResponsiveContainer>
                <BarChart
                  data={[
                    { name: "Combustible", prev: totals.prevFuelCost, current: totals.currentFuelCost },
                    { name: "Mantenimiento", prev: totals.prevMaintenanceCost, current: totals.currentMaintenanceCost },
                    { name: "Total", prev: totals.prevOverallCost, current: totals.currentOverallCost },
                  ]}
                  margin={{ top: 8, right: 16, bottom: 8, left: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis width={84} tickMargin={8} tickLine={false} axisLine={false}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any, name: any) => {
                    const label = name === 'current' ? 'Actual' : name === 'prev' ? 'Anterior' : String(name);
                    return `${label}: ${formatCurrency(Number(value))}`;
                  }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="prev" fill="hsl(var(--chart-2))" radius={[6,6,0,0]} />
                  <Bar dataKey="current" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}
