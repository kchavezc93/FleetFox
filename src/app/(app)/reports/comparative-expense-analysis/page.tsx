
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChartHorizontalBig, FileDown, Filter, CalendarDays, Printer } from "lucide-react";
import type { FuelingLog, MaintenanceLog, Vehicle } from "@/types";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { getFuelingLogs } from "@/lib/actions/fueling-actions";
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";

const LITERS_PER_GALLON = 3.78541;

interface ComparativeData {
  totalMaintenanceCost: number;
  totalFuelingCost: number;
  totalOverallCost: number;
  totalGallonsConsumed: number;
  maintenanceLogCount: number;
  fuelingLogCount: number;
  kmDrivenInPeriod: number | null;
  costPerKm: number | null;
  avgFuelEfficiency: number | null;
  vehicleBreakdown: Array<{
    vehicleId: string;
    plateNumber: string;
    brandModel: string;
    maintenanceCost: number;
    fuelingCost: number;
    totalCost: number;
    kmDriven: number | null;
  }>;
}

export default function ComparativeExpenseAnalysisPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [fuelingLogs, setFuelingLogs] = useState<FuelingLog[]>([]);
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

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        const [vehiclesData, maintenanceLogsData, fuelingLogsData] = await Promise.all([
          getVehicles(),
          getMaintenanceLogs(),
          getFuelingLogs(),
        ]);
        setVehicles(vehiclesData);
        setMaintenanceLogs(maintenanceLogsData);
        setFuelingLogs(fuelingLogsData);
      } catch (error) {
        console.error("Error loading report data:", error);
        // Consider setting an error state here
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const comparativeData = useMemo((): ComparativeData => {
    let filteredMaintenanceLogs = maintenanceLogs;
    let filteredFuelingLogs = fuelingLogs;

    // Filter by Date Range
    if (dateRange?.from && dateRange?.to) {
      const interval = { start: dateRange.from, end: dateRange.to };
      filteredMaintenanceLogs = filteredMaintenanceLogs.filter(log => isWithinInterval(parseISO(log.executionDate + "T00:00:00"), interval));
      filteredFuelingLogs = filteredFuelingLogs.filter(log => isWithinInterval(parseISO(log.fuelingDate + "T00:00:00"), interval));
    }

    // Filter by Vehicle
    if (selectedVehicleId !== "all") {
      filteredMaintenanceLogs = filteredMaintenanceLogs.filter(log => log.vehicleId === selectedVehicleId);
      filteredFuelingLogs = filteredFuelingLogs.filter(log => log.vehicleId === selectedVehicleId);
    }

    // Filter by Expense Type
    if (selectedExpenseType === "maintenance") {
      filteredFuelingLogs = [];
    } else if (selectedExpenseType === "fueling") {
      filteredMaintenanceLogs = [];
    }
    
    const targetVehicles = selectedVehicleId === "all" ? vehicles : vehicles.filter(v => v.id === selectedVehicleId);

    const vehicleBreakdown = targetVehicles.map(vehicle => {
      const vehicleMaintLogs = filteredMaintenanceLogs.filter(log => log.vehicleId === vehicle.id);
      const vehicleFuelLogs = filteredFuelingLogs.filter(log => log.vehicleId === vehicle.id);
      
      const maintenanceCost = vehicleMaintLogs.reduce((sum, log) => sum + log.cost, 0);
      const fuelingCost = vehicleFuelLogs.reduce((sum, log) => sum + log.totalCost, 0);

      // Calculate km driven for this vehicle in period
      let kmDrivenThisVehicle: number | null = null;
      const allLogsForKm = [...vehicleMaintLogs.map(l => ({date: l.executionDate, mileage: l.mileageAtService})), ...vehicleFuelLogs.map(l => ({date: l.fuelingDate, mileage: l.mileageAtFueling}))]
        .filter(l => l.mileage != null)
        .sort((a,b) => new Date(a.date + "T00:00:00").getTime() - new Date(b.date + "T00:00:00").getTime() || a.mileage - b.mileage);

      if(allLogsForKm.length >= 2) {
        kmDrivenThisVehicle = allLogsForKm[allLogsForKm.length -1].mileage - allLogsForKm[0].mileage;
      } else if (allLogsForKm.length === 1 && vehicle.currentMileage) {
        // Fallback: if only one log in period, try to estimate based on vehicle's current mileage IF it makes sense
        // This is a rough estimation and might not be accurate for past periods.
        // For more accuracy, you'd need mileage at the start/end of the period from the vehicle entity or more logs.
        // kmDrivenThisVehicle = vehicle.currentMileage - allLogsForKm[0].mileage; 
        // Disabling this rough estimation for now as it can be misleading.
      }


      return {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        brandModel: `${vehicle.brand} ${vehicle.model}`,
        maintenanceCost,
        fuelingCost,
        totalCost: maintenanceCost + fuelingCost,
        kmDriven: kmDrivenThisVehicle,
      };
    });

    const totalMaintenanceCost = vehicleBreakdown.reduce((sum, v) => sum + v.maintenanceCost, 0);
    const totalFuelingCost = vehicleBreakdown.reduce((sum, v) => sum + v.fuelingCost, 0);
    const totalOverallCost = totalMaintenanceCost + totalFuelingCost;
    const totalGallonsConsumed = filteredFuelingLogs.reduce((sum, log) => sum + (log.quantityLiters / LITERS_PER_GALLON), 0);
    const kmDrivenInPeriod = vehicleBreakdown.reduce((sum, v) => sum + (v.kmDriven || 0), 0) || null;


    return {
      totalMaintenanceCost,
      totalFuelingCost,
      totalOverallCost,
      totalGallonsConsumed,
      maintenanceLogCount: filteredMaintenanceLogs.length,
      fuelingLogCount: filteredFuelingLogs.length,
      kmDrivenInPeriod,
      costPerKm: kmDrivenInPeriod && totalOverallCost > 0 ? totalOverallCost / kmDrivenInPeriod : null,
      avgFuelEfficiency: kmDrivenInPeriod && totalGallonsConsumed > 0 ? kmDrivenInPeriod / totalGallonsConsumed : null,
      vehicleBreakdown,
    };
  }, [vehicles, maintenanceLogs, fuelingLogs, selectedVehicleId, selectedExpenseType, dateRange]);

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    if (comparativeData.vehicleBreakdown.length === 0 && selectedVehicleId === "all") return;
    if (selectedVehicleId !== "all" && !comparativeData.vehicleBreakdown.find(v => v.vehicleId === selectedVehicleId)) return;
    
    let reportRows: string[] = [];
    const headers = ["Métrica", "Valor"];
    
    // General Summary
    reportRows.push("Resumen General");
    reportRows.push(headers.join('\t')); // Use tab as separator for better Excel import
    reportRows.push(`Costo Total Mantenimiento (C$)\tC$${comparativeData.totalMaintenanceCost.toFixed(2)}`);
    reportRows.push(`Costo Total Combustible (C$)\tC$${comparativeData.totalFuelingCost.toFixed(2)}`);
    reportRows.push(`Costo Total General (C$)\tC$${comparativeData.totalOverallCost.toFixed(2)}`);
    reportRows.push(`Galones Totales Consumidos\t${comparativeData.totalGallonsConsumed.toFixed(2)}`);
    reportRows.push(`Kilómetros Recorridos\t${comparativeData.kmDrivenInPeriod?.toLocaleString() ?? 'N/A'}`);
    reportRows.push(`Costo por Km (C$)\t${comparativeData.costPerKm ? 'C$' + comparativeData.costPerKm.toFixed(2) : 'N/A'}`);
    reportRows.push(`Eficiencia Prom. (km/gal)\t${comparativeData.avgFuelEfficiency ? comparativeData.avgFuelEfficiency.toFixed(1) : 'N/A'}`);
    reportRows.push(`Num. Registros Mantenimiento\t${comparativeData.maintenanceLogCount}`);
    reportRows.push(`Num. Registros Combustible\t${comparativeData.fuelingLogCount}`);
    reportRows.push(""); // Spacer

    // Vehicle Breakdown (if 'all' or specific vehicle has data)
    if (selectedVehicleId === "all" && comparativeData.vehicleBreakdown.length > 0) {
      reportRows.push("Desglose por Vehículo");
      const vehicleHeaders = ["Matrícula", "Marca y Modelo", "Costo Mantenimiento (C$)", "Costo Combustible (C$)", "Costo Total (C$)", "Km Recorridos"];
      reportRows.push(vehicleHeaders.join('\t'));
      comparativeData.vehicleBreakdown.forEach(v => {
        reportRows.push([
          v.plateNumber,
          v.brandModel,
          `C$${v.maintenanceCost.toFixed(2)}`,
          `C$${v.fuelingCost.toFixed(2)}`,
          `C$${v.totalCost.toFixed(2)}`,
          v.kmDriven?.toLocaleString() ?? 'N/A'
        ].join('\t'));
      });
    } else if (selectedVehicleId !== "all") {
        const vehicleData = comparativeData.vehicleBreakdown.find(v => v.vehicleId === selectedVehicleId);
        if (vehicleData) {
            reportRows.push(`Detalle Vehículo: ${vehicleData.plateNumber}`);
            reportRows.push(["Métrica", "Valor"].join('\t'));
            reportRows.push(`Costo Mantenimiento (C$)\tC$${vehicleData.maintenanceCost.toFixed(2)}`);
            reportRows.push(`Costo Combustible (C$)\tC$${vehicleData.fuelingCost.toFixed(2)}`);
            reportRows.push(`Costo Total (C$)\tC$${vehicleData.totalCost.toFixed(2)}`);
            reportRows.push(`Km Recorridos\t${vehicleData.kmDriven?.toLocaleString() ?? 'N/A'}`);
        }
    }

    const reportString = reportRows.join('\n');
    const blob = new Blob([reportString], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_comparativo_gastos.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
            <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportExcel} disabled={isLoading || (!comparativeData.vehicleBreakdown.length && selectedVehicleId === 'all') }>
              <FileDown className="mr-2 h-4 w-4" /> Exportar Informe (Excel)
            </Button>
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
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle>
            Resumen de Gastos 
            {selectedVehicleInfo ? ` para ${selectedVehicleInfo.plateNumber}` : selectedVehicleId === "all" ? " (Todos los Vehículos)" : ""}
            {dateRange?.from && dateRange?.to ? ` (${format(dateRange.from, "P", {locale:es})} - ${format(dateRange.to, "P", {locale:es})})` : ""}
          </CardTitle>
          <CardDescription>
            Costos consolidados según los filtros aplicados.
            {isLoading && " Cargando datos..."}
            {!isLoading && !maintenanceLogs.length && !fuelingLogs.length && " No hay datos para los filtros seleccionados o la BD no está conectada."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-sm font-medium">Costo Mantenimiento</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">C${comparativeData.totalMaintenanceCost.toFixed(2)}</p></CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardHeader><CardTitle className="text-sm font-medium">Costo Combustible</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">C${comparativeData.totalFuelingCost.toFixed(2)}</p></CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground">
                <CardHeader><CardTitle className="text-sm font-medium">Costo Total General</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">C${comparativeData.totalOverallCost.toFixed(2)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Galones Consumidos</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.totalGallonsConsumed.toFixed(2)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Km Recorridos (Período)</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.kmDrivenInPeriod?.toLocaleString() ?? 'N/A'}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Costo por Km (General)</CardTitle></CardHeader>
                <CardContent><p className="text-xl">{comparativeData.costPerKm ? `C$${comparativeData.costPerKm.toFixed(2)}` : 'N/A'}</p></CardContent>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Marca y Modelo</TableHead>
                    <TableHead className="text-right">Costo Mantenimiento (C$)</TableHead>
                    <TableHead className="text-right">Costo Combustible (C$)</TableHead>
                    <TableHead className="text-right">Costo Total (C$)</TableHead>
                    <TableHead className="text-right">Km Recorridos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativeData.vehicleBreakdown.filter(v => v.totalCost > 0 || v.kmDriven).map(v => (
                    <TableRow key={v.vehicleId}>
                      <TableCell>{v.plateNumber}</TableCell>
                      <TableCell>{v.brandModel}</TableCell>
                      <TableCell className="text-right">C${v.maintenanceCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">C${v.fuelingCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">C${v.totalCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{v.kmDriven?.toLocaleString() ?? 'N/A'}</TableCell>
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
          <CardTitle>Gráfico Comparativo (Marcador de posición)</CardTitle>
          <CardDescription>Visualización de los gastos. Funcionalidad de gráficos pendiente de implementación con BD.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center">
            <Image 
              src="https://placehold.co/800x300.png" 
              alt="Marcador de Posición de Gráfico Comparativo" 
              width={800} 
              height={300}
              data-ai-hint="comparison chart costs"
              className="rounded-md"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
