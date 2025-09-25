
import { requirePermission } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Fuel, Wrench, ArrowRight, ListChecks, History, CalendarClock, TrendingUp, BarChartHorizontalBig } from "lucide-react";
import Link from "next/link";

export default async function ReportsPage() {
  await requirePermission('/reports');
  const reports = [
    {
      title: "Informe de Consumo de Combustible",
      description: "Analiza el uso de combustible, costos y eficiencia por vehículo o en toda la flota.",
      href: "/reports/fuel-consumption",
      icon: Fuel,
    },
    {
      title: "Informe de Costos de Mantenimiento",
      description: "Realiza un seguimiento de los gastos de mantenimiento, identifica tendencias y gestiona tu presupuesto.",
      href: "/reports/maintenance-costs",
      icon: Wrench,
    },
    {
      title: "Informe de Costos Generales por Vehículo",
      description: "Consolida todos los gastos de combustible y mantenimiento para cada vehículo en un solo lugar.",
      href: "/reports/overall-vehicle-costs",
      icon: ListChecks,
    },
    {
      title: "Informe de Historial de Mantenimiento",
      description: "Consulta el historial detallado de todos los servicios de mantenimiento realizados por vehículo.",
      href: "/reports/maintenance-history",
      icon: History,
    },
    {
      title: "Informe de Mantenimiento Próximo",
      description: "Identifica los vehículos que se acercan a su próximo mantenimiento programado.",
      href: "/reports/upcoming-maintenance",
      icon: CalendarClock,
    },
    {
      title: "Informe de Análisis de Eficiencia de Combustible",
      description: "Analiza tendencias y compara la eficiencia de combustible (km/gal) entre vehículos.",
      href: "/reports/fuel-efficiency-analysis",
      icon: TrendingUp,
    },
    {
      title: "Informe Comparativo de Gastos",
      description: "Compara gastos de mantenimiento y combustible con filtros por vehículo y período.",
      href: "/reports/comparative-expense-analysis",
      icon: BarChartHorizontalBig,
    },
  ];

  return (
    <>
      <PageHeader
        title="Informes de Flota"
        description="Obtén información sobre el rendimiento y los costos operativos de tu flota."
        icon={BarChart3}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <report.icon className="h-8 w-8 text-primary" />
                <CardTitle className="text-primary">{report.title}</CardTitle>
              </div>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex items-end">
              <Link href={report.href} className="w-full">
                <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                  Ver Informe <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
       <div className="mt-12 p-6 bg-muted/50 rounded-lg text-center">
          <p className="text-muted-foreground">
            Implementa la conexión a la base de datos para visualizar datos reales en estos informes.
          </p>
        </div>
    </>
  );
}

