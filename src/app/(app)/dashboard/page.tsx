
// src/app/(app)/dashboard/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert as AlertUI, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CarFront, Wrench, Fuel, Bell, ArrowRight, AlertTriangle, PieChart, ListChecks, DollarSign, BarChartHorizontalBig } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Alert as AlertType, MaintenanceLog, FuelingLog } from "@/types";
import { getVehicles, getUpcomingMaintenanceCount } from "@/lib/actions/vehicle-actions"; // Añadido getUpcomingMaintenanceCount
import { getMaintenanceLogs } from "@/lib/actions/maintenance-actions";
import { getFuelingLogs } from "@/lib/actions/fueling-actions";
// PRODUCCIÓN: Para Alertas Recientes, necesitarás implementar:
// 1. Una tabla 'alerts' en tu base de datos.
// 2. Un archivo 'src/lib/actions/alert-actions.ts' con funciones como:
//    - getRecentAlerts(): Que obtenga las N alertas más recientes (ej. las últimas 5 no resueltas).
//    - createAlert(...): Para generar alertas (ej. cuando un mantenimiento está próximo).
//    - updateAlertStatus(...): Para marcar alertas como vistas o resueltas.
// import { getRecentAlerts } from "@/lib/actions/alert-actions"; // Descomentar cuando esté implementado


const getSpanishAlertType = (alertType: string): string => {
  // Esta función es un placeholder. En producción, las traducciones de tipos de alerta
  // deberían manejarse de forma más robusta, quizás desde la BD o un sistema i18n.
  const formattedType = alertType.replace(/([A-Z])/g, ' $1').trim();
  switch (formattedType) {
    case "Preventive Maintenance Due":
      return "Mantenimiento Preventivo Vencido";
    // Añadir otras traducciones específicas si se conocen
    default:
      return formattedType; 
  }
};

export default function DashboardPage() {
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);
  const [vehiclesInShop, setVehiclesInShop] = useState(0);
  const [inactiveVehicles, setInactiveVehicles] = useState(0);
  const [upcomingMaintenanceCount, setUpcomingMaintenanceCount] = useState(0); // Nuevo estado
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonthMaintenanceCost, setCurrentMonthMaintenanceCost] = useState(0);
  const [currentMonthFuelingCost, setCurrentMonthFuelingCost] = useState(0);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      // PRODUCCIÓN: En un entorno real, considera usar React Query o SWR para manejar
      // el estado de carga, errores y cacheo de estas llamadas de datos.
      try {
        const vehiclesData = await getVehicles(); 
        setTotalVehicles(vehiclesData.length);
        setActiveVehicles(vehiclesData.filter(v => v.status === "Activo").length);
        setVehiclesInShop(vehiclesData.filter(v => v.status === "En Taller").length);
        setInactiveVehicles(vehiclesData.filter(v => v.status === "Inactivo").length);

        // Obtener conteo de mantenimientos próximos
        const upcomingCount = await getUpcomingMaintenanceCount();
        setUpcomingMaintenanceCount(upcomingCount);

        const maintenanceLogsData = await getMaintenanceLogs();
        const fuelingLogsData = await getFuelingLogs();
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        const monthlyMaintenanceCost = maintenanceLogsData
          .filter(log => {
            // Asegurar que log.executionDate es un string YYYY-MM-DD
            // y convertirlo a Date objeto de forma segura para comparar.
            // Es importante que la zona horaria se maneje consistentemente.
            // new Date(string) puede ser problemático con formatos sin zona horaria explícita.
            // 'log.executionDate + "T00:00:00"' asume que la fecha es local.
            const logDate = new Date(log.executionDate + "T00:00:00"); 
            return logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth;
          })
          .reduce((sum, log) => sum + log.cost, 0);
        setCurrentMonthMaintenanceCost(monthlyMaintenanceCost);

        const monthlyFuelingCost = fuelingLogsData
          .filter(log => {
            const logDate = new Date(log.fuelingDate + "T00:00:00");
            return logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth;
          })
          .reduce((sum, log) => sum + log.totalCost, 0);
        setCurrentMonthFuelingCost(monthlyFuelingCost);

        // PRODUCCIÓN: Descomentar y usar cuando getRecentAlerts esté implementado
        // const alertsData = await getRecentAlerts(); // Esta función debe ser creada en alert-actions.ts
        // setRecentAlerts(alertsData);
        setRecentAlerts([]); // Mantener vacío hasta que la lógica de BD para alertas esté implementada

      } catch (error) {
        console.error("Falla al cargar datos para el dashboard:", error);
        // PRODUCCIÓN: Mostrar un mensaje de error al usuario o un estado de error en la UI.
        // logger.error({ context: 'DashboardPage_loadDashboardData', error }, "Failed to load dashboard data");
        setTotalVehicles(0);
        setActiveVehicles(0);
        setVehiclesInShop(0);
        setInactiveVehicles(0);
        setUpcomingMaintenanceCount(0);
        setCurrentMonthMaintenanceCost(0);
        setCurrentMonthFuelingCost(0);
        setRecentAlerts([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Panel de Control</h1>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Cargando datos...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Por favor espere mientras se cargan las estadísticas del dashboard.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vehículos Totales</CardTitle>
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
                <CardTitle className="text-sm font-medium">Mantenimiento Próximo</CardTitle>
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
                <CardTitle className="text-sm font-medium">Alertas Recientes</CardTitle>
                <Bell className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {/* PRODUCCIÓN: Este valor vendrá de `getRecentAlerts().filter(a => a.status === "Nueva").length` */}
                <div className="text-2xl font-bold">{recentAlerts.filter(a => a.status === "Nueva").length}</div>
                <p className="text-xs text-muted-foreground">
                 Nuevas alertas que requieren atención (Lógica pendiente en alert-actions.ts)
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/vehicles/new" passHref>
                  <Button className="w-full justify-start" variant="outline">
                    <CarFront className="mr-2 h-4 w-4" /> Agregar Nuevo Vehículo
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/maintenance/new" passHref>
                  <Button className="w-full justify-start" variant="outline">
                    <Wrench className="mr-2 h-4 w-4" /> Registrar Mantenimiento
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/fueling/new" passHref>
                  <Button className="w-full justify-start" variant="outline">
                    <Fuel className="mr-2 h-4 w-4" /> Registrar Carga de Combustible
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Alertas Recientes</CardTitle>
                <CardDescription>
                  {/* PRODUCCIÓN: La descripción cambiará cuando se implemente la lógica de alertas */}
                  Alertas críticas y nuevas para su flota. (Lógica de BD para alertas pendiente en alert-actions.ts)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {/* PRODUCCIÓN: El contenido se llenará con los datos de `recentAlerts` */}
                {recentAlerts.length > 0 ? recentAlerts.slice(0, 5).map(alert => (
                  <AlertUI key={alert.id} variant={alert.severity === "High" ? "destructive" : "default"} className="border-l-4" style={alert.severity === "High" ? {borderColor: "hsl(var(--destructive))"} : alert.severity === "Medium" ? {borderColor: "hsl(var(--accent))"} : {borderColor: "hsl(var(--muted))"}}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-semibold">{getSpanishAlertType(alert.alertType)} - {alert.vehiclePlateNumber}</AlertTitle>
                    <AlertDescription className="text-xs">
                      {alert.message} {alert.dueDate && `(Vence: ${new Date(alert.dueDate).toLocaleDateString()})`}
                    </AlertDescription>
                  </AlertUI>
                )) : (
                  <p className="text-sm text-muted-foreground">No hay alertas nuevas. (Lógica de BD pendiente)</p>
                )}
                {recentAlerts.length > 5 && (
                    <Link href="/alerts" className="text-sm text-primary hover:underline">Ver todas las alertas</Link>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-primary flex items-center"><DollarSign className="mr-2 h-6 w-6"/>Resumen de Gastos del Mes Actual</CardTitle>
              <CardDescription>Visualización de los gastos de mantenimiento y combustible para el mes corriente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Costos del Mes</CardTitle>
                  <CardDescription>Desglose de gastos incurridos en el mes actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="flex items-center"><Wrench className="mr-2 h-4 w-4 text-muted-foreground"/>Mantenimiento:</span> 
                    <span className="font-medium">C${currentMonthMaintenanceCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center"><Fuel className="mr-2 h-4 w-4 text-muted-foreground"/>Combustible:</span> 
                    <span className="font-medium">C${currentMonthFuelingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>Total General (Mes):</span> 
                    <span>C${(currentMonthMaintenanceCost + currentMonthFuelingCost).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-muted-foreground"/>Comparación de Gastos (Gráfico)</CardTitle>
                   <CardDescription>
                     {/* PRODUCCIÓN: Este gráfico se implementaría con una librería como Recharts o Chart.js */}
                     Representación visual de los gastos de mantenimiento vs. combustible. (Funcionalidad pendiente de implementación de gráficos)
                   </CardDescription>
                </CardHeader>
                <CardContent className="h-48 bg-muted/50 rounded-lg flex items-center justify-center p-4">
                   <Image 
                    src="https://placehold.co/400x200.png" 
                    alt="Gráfico de Comparación de Gastos (Marcador de posición)" 
                    width={400} 
                    height={200}
                    data-ai-hint="monthly costs bar chart"
                    className="rounded-md opacity-75"
                  />
                  {/* 
                    PRODUCCIÓN: Ejemplo de cómo se podría usar un componente de gráfico (ej. Recharts)
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{name: 'Gastos', Mantenimiento: currentMonthMaintenanceCost, Combustible: currentMonthFuelingCost}]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => \`C$\${Number(value).toFixed(2)}\`} />
                        <Legend />
                        <Bar dataKey="Mantenimiento" fill="hsl(var(--primary))" />
                        <Bar dataKey="Combustible" fill="hsl(var(--accent))" />
                      </BarChart>
                    </ResponsiveContainer>
                  */}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
