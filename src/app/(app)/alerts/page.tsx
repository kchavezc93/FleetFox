
import { PageHeader } from "@/components/page-header";
import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        title="Alertas del Sistema"
        description="Visualiza y gestiona las alertas generadas para tu flota."
        icon={Bell}
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Alertas</CardTitle>
          <CardDescription>
            Esta sección mostrará las alertas activas y resueltas. (Funcionalidad pendiente de implementación)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No hay alertas para mostrar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              La funcionalidad de alertas está en desarrollo. La lógica para obtener y mostrar alertas de la base de datos necesita ser implementada.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
