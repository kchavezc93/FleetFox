// src/app/(app)/dashboard/page.tsx
import { requirePermission } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert as AlertUI, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CarFront, Wrench, Fuel, Bell, ArrowRight, AlertTriangle, DollarSign, BarChartHorizontalBig } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import MonthlyCostChart from "@/components/monthly-cost-chart";
import { getVehicles, getUpcomingMaintenanceCount } from "@/lib/actions/vehicle-actions";
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getFuelingLogs } from "@/lib/actions/fueling-actions";
import { getRecentAlerts } from "@/lib/actions/alert-actions";


const getSpanishAlertType = (alertType: string): string => {
  // Mapeo explícito para tipos de alerta conocidos en producción
  switch (alertType) {
    case "PreventiveMaintenanceDue":
    case "Preventive Maintenance Due":
      return "Mantenimiento preventivo próximo";
    case "DocumentExpiry":
      return "Documento por vencer";
    case "LowMileageEfficiency":
      return "Eficiencia de combustible baja";
    case "HighMaintenanceCost":
      return "Costo de mantenimiento elevado";
    default:
      return alertType.replace(/([A-Z])/g, ' $1').trim();
  }
};
export default async function DashboardPage() {
  await requirePermission('/dashboard');

  // Cargar datos en el servidor
  let totalVehicles = 0;
  let activeVehicles = 0;
  let vehiclesInShop = 0;
  let inactiveVehicles = 0;
  let upcomingMaintenanceCount = 0;
  let currentMonthMaintenanceCost = 0;
  let currentMonthFuelingCost = 0;
  let recentAlerts: any[] = [];

  try {
    const vehiclesData = await getVehicles();
    totalVehicles = vehiclesData.length;
    activeVehicles = vehiclesData.filter(v => v.status === "Activo").length;
    vehiclesInShop = vehiclesData.filter(v => v.status === "En Taller").length;
    inactiveVehicles = vehiclesData.filter(v => v.status === "Inactivo").length;

    upcomingMaintenanceCount = await getUpcomingMaintenanceCount();

    const maintenanceLogsData = await getMaintenanceLogs();
    const fuelingLogsData = await getFuelingLogs();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    currentMonthMaintenanceCost = maintenanceLogsData
      .filter((log: any) => {
        const logDate = new Date(String(log.executionDate) + "T00:00:00");
        return logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth;
      })
      .reduce((sum: number, log: any) => sum + Number(log.cost || 0), 0);

    currentMonthFuelingCost = fuelingLogsData
      .filter((log: any) => {
        const logDate = new Date(String(log.fuelingDate) + "T00:00:00");
        return logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth;
      })
      .reduce((sum: number, log: any) => sum + Number(log.totalCost || 0), 0);

    recentAlerts = await getRecentAlerts();
  } catch (error) {
    console.error("Falla al cargar datos para el dashboard:", error);
    // Los valores por defecto (0 / []) permanecerán.
  }

  // Formateador de moneda (ajustable vía entorno si en el futuro se internacionaliza)
  const nf = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Panel de control</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehículos totales</CardTitle>
            <CarFront className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVehicles}</div>
            <p className="text-xs text-muted-foreground">
              {activeVehicles} activos, {vehiclesInShop} en taller, {inactiveVehicles} inactivos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mantenimiento próximo</CardTitle>
            <Wrench className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingMaintenanceCount}</div>
            <p className="text-xs text-muted-foreground">
              En los próximos 7 días o 1000km (Ejemplo de lógica en getUpcomingMaintenanceCount)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas recientes</CardTitle>
            <Bell className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentAlerts.filter((a: any) => a.status === "Nueva").length}</div>
            <p className="text-xs text-muted-foreground">
             Nuevas alertas que requieren atención
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/vehicles/new" passHref>
              <Button className="w-full justify-start" variant="outline">
                <CarFront className="mr-2 h-4 w-4" /> Agregar vehículo
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <Link href="/maintenance/new" passHref>
              <Button className="w-full justify-start" variant="outline">
                <Wrench className="mr-2 h-4 w-4" /> Registrar mantenimiento
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <Link href="/fueling/new" passHref>
              <Button className="w-full justify-start" variant="outline">
                <Fuel className="mr-2 h-4 w-4" /> Registrar carga de combustible
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Alertas recientes</CardTitle>
            <CardDescription>
              Alertas críticas y nuevas de la flota.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {recentAlerts.length > 0 ? recentAlerts.slice(0, 5).map((alert: any) => (
              <AlertUI key={alert.id} variant={alert.severity === "High" ? "destructive" : "default"} className="border-l-4" style={alert.severity === "High" ? {borderColor: "hsl(var(--destructive))"} : alert.severity === "Medium" ? {borderColor: "hsl(var(--accent))"} : {borderColor: "hsl(var(--muted))"}}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-semibold">{getSpanishAlertType(alert.alertType)} - {alert.vehiclePlateNumber}</AlertTitle>
                <AlertDescription className="text-xs">
                  {alert.message} {alert.dueDate && `(Vence: ${new Date(alert.dueDate).toLocaleDateString()})`}
                </AlertDescription>
              </AlertUI>
            )) : (
              <p className="text-sm text-muted-foreground">No hay alertas nuevas.</p>
            )}
            {recentAlerts.length > 5 && (
                <Link href="/alerts" className="text-sm text-primary hover:underline">Ver todas las alertas</Link>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-primary flex items-center"><DollarSign className="mr-2 h-6 w-6"/>Gastos del mes en curso</CardTitle>
          <CardDescription>Gastos de mantenimiento y combustible del mes actual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Costos</CardTitle>
              <CardDescription>Desglose del mes actual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center"><Wrench className="mr-2 h-4 w-4 text-muted-foreground"/>Mantenimiento:</span> 
                <span className="font-medium">{nf.format(currentMonthMaintenanceCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center"><Fuel className="mr-2 h-4 w-4 text-muted-foreground"/>Combustible:</span> 
                <span className="font-medium">{nf.format(currentMonthFuelingCost)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold">
                <span>Total general (mes):</span> 
                <span>{nf.format(currentMonthMaintenanceCost + currentMonthFuelingCost)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-muted-foreground"/>Comparación de gastos</CardTitle>
               <CardDescription>
                 Mantenimiento vs. combustible en el mes actual.
               </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <MonthlyCostChart maintenance={currentMonthMaintenanceCost} fueling={currentMonthFuelingCost} />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
