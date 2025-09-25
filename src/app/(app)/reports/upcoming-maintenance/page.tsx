
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, FileDown, Filter, Printer } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UpcomingMaintenanceItem } from "@/lib/actions/report-actions";
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
import { format, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const DEFAULT_DAYS_THRESHOLD = 30; // Mantenimiento en los próximos X días
const DEFAULT_MILEAGE_THRESHOLD = 2000; // Mantenimiento en los próximos X km

export default function UpcomingMaintenanceReportPage() {
  const [upcomingVehicles, setUpcomingVehicles] = useState<UpcomingMaintenanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");

  const [daysThreshold, setDaysThreshold] = useState<number>(DEFAULT_DAYS_THRESHOLD);
  const [kmThreshold, setKmThreshold] = useState<number>(DEFAULT_MILEAGE_THRESHOLD);

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
        params.set("daysThreshold", String(daysThreshold));
        params.set("mileageThreshold", String(kmThreshold));
        if (selectedVehicleId !== "all") params.set("vehicleId", selectedVehicleId);
        const res = await fetch(`/api/reports/upcoming-maintenance?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error cargando informe: ${res.status}`);
        const data: UpcomingMaintenanceItem[] = await res.json();
        setUpcomingVehicles(data);
      } catch (error) {
        console.error("Error loading upcoming maintenance report data:", error);
        setUpcomingVehicles([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadReportData();
  }, [selectedVehicleId, daysThreshold, kmThreshold]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (upcomingVehicles.length === 0) return;

    const headers = ["Vehículo (Matrícula)", "Marca y Modelo", "Próx. Mantenimiento (Fecha)", "Próx. Mantenimiento (Km)", "Alerta Por", "Días Restantes", "Km Restantes"];
    const csvRows = [
      headers.join(','),
      ...upcomingVehicles.map(v => [
        v.plateNumber,
        `${v.brand} ${v.model}`,
  v.nextPreventiveMaintenanceDate ? formatDateDDMMYYYY(v.nextPreventiveMaintenanceDate) : 'N/D',
        v.nextPreventiveMaintenanceMileage != null ? v.nextPreventiveMaintenanceMileage.toLocaleString() : 'N/D',
        v.reason,
        v.daysToNextMaintenance ?? 'N/A',
        v.kmToNextMaintenance?.toLocaleString() ?? 'N/A'
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'informe_mantenimiento_proximo.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXLSX = async () => {
    if (upcomingVehicles.length === 0) return;
    const rows = upcomingVehicles.map(v => ({
      plate: v.plateNumber,
      brandModel: `${v.brand} ${v.model}`,
      nextDate: v.nextPreventiveMaintenanceDate ?? null,
      nextKm: v.nextPreventiveMaintenanceMileage ?? null,
      reason: v.reason,
      daysLeft: v.daysToNextMaintenance ?? null,
      kmLeft: v.kmToNextMaintenance ?? null,
    }));
    await exportToXLSX({
      rows,
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "brandModel", header: "Marca y Modelo", width: 28 },
        { key: "nextDate", header: "Próx. Mantenimiento (Fecha)", format: "date" },
        { key: "nextKm", header: "Próx. Mantenimiento (Km)", format: "integer" },
        { key: "reason", header: "Alerta Por" },
        { key: "daysLeft", header: "Días Restantes", format: "integer" },
        { key: "kmLeft", header: "Km Restantes", format: "integer" },
      ],
    }, "informe_mantenimiento_proximo", "Próximo");
  };

  return (
    <>
      <PageHeader
        title="Informe de Mantenimiento Próximo"
        description={`Vehículos que requieren mantenimiento preventivo en los próximos ${daysThreshold} días o ${kmThreshold} km.`}
        icon={CalendarClock}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Umbrales rápidos</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setDaysThreshold(15)}>En 15 días</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDaysThreshold(30)}>En 30 días</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDaysThreshold(60)}>En 60 días</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setKmThreshold(1000)}>En 1,000 km</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setKmThreshold(2000)}>En 2,000 km</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setKmThreshold(3000)}>En 3,000 km</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV} disabled={upcomingVehicles.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleExportXLSX} disabled={upcomingVehicles.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
              </Button>
            </div>
          </div>
        }
      />
      <Card className="shadow-lg printable-area">
        <CardHeader>
          <CardTitle className="text-2xl">Vehículos con Mantenimiento Próximo</CardTitle>
          <CardDescription>
            Lista de vehículos cuyo mantenimiento preventivo está programado o se acerca según los umbrales configurados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando datos del informe...</p>
          ) : upcomingVehicles.length === 0 ? (
            <p className="text-muted-foreground">No hay vehículos con mantenimiento próximo o no hay datos disponibles. Verifique la implementación de la base de datos.</p>
          ) : (
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Vehículo (Matrícula)</TableHead>
                  <TableHead className="font-semibold">Marca y Modelo</TableHead>
                  <TableHead className="font-semibold">Próx. Mantenimiento (Fecha)</TableHead>
                  <TableHead className="font-semibold">Próx. Mantenimiento (Km)</TableHead>
                  <TableHead className="font-semibold">Alerta Por</TableHead>
                  <TableHead className="text-right font-semibold">Días Restantes</TableHead>
                  <TableHead className="text-right font-semibold">Km Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingVehicles.map(vehicle => (
                  <TableRow key={vehicle.vehicleId}>
                    <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                    <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                    <TableCell>{vehicle.nextPreventiveMaintenanceDate ? formatDateDDMMYYYY(vehicle.nextPreventiveMaintenanceDate) : "N/D"}</TableCell>
                    <TableCell>{vehicle.nextPreventiveMaintenanceMileage != null ? vehicle.nextPreventiveMaintenanceMileage.toLocaleString() : 'N/D'} km</TableCell>
                    <TableCell>
                        <Badge 
                            variant={vehicle.reason === "Fecha" ? "default" : vehicle.reason === "Kilometraje" ? "secondary" : "destructive"}
                            className={vehicle.reason === "Ambos" ? "bg-red-500 text-white" : ""}
                        >
                            {vehicle.reason}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">{vehicle.daysToNextMaintenance ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{vehicle.kmToNextMaintenance?.toLocaleString() ?? 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
