
"use client";

import { PageHeader } from "@/components/page-header";
import { Bell, RefreshCw, Eye, CheckCircle2, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import type { Alert } from "@/types";
import { getAlerts, updateAlertStatus, generateAlerts } from "@/lib/actions/alert-actions";
import { requirePermission } from "@/lib/authz";

export default function AlertsPage() {
  // Client page; permission enforced server-side in layout. Optionally, can add a server component wrapper if needed.
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [statusFilter, setStatusFilter] = useState<Alert["status"] | "all">("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getAlerts(statusFilter === "all" ? {} : { status: statusFilter });
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function markStatus(id: string, status: Alert["status"]) {
    setWorking(true);
    try {
      await updateAlertStatus(id, status);
      await load();
    } finally {
      setWorking(false);
    }
  }

  async function handleGenerate() {
    setWorking(true);
    try {
      await generateAlerts();
      await load();
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Alertas del Sistema"
        description="Visualiza y gestiona las alertas generadas para tu flota."
        icon={Bell}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="min-w-[200px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Nueva">Nuevas</SelectItem>
                  <SelectItem value="Vista">Vistas</SelectItem>
                  <SelectItem value="Resuelta">Resueltas</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={load} disabled={loading}>
                <Filter className="mr-2 h-4 w-4" /> Aplicar
              </Button>
            </div>
            <Button onClick={handleGenerate} disabled={working} className="bg-primary hover:bg-primary/90">
              <RefreshCw className="mr-2 h-4 w-4" /> Generar ahora
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Alertas</CardTitle>
          <CardDescription>
            Gestiona las alertas: márcalas como vistas o resueltas. Usa "Generar ahora" para evaluar las reglas al instante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando alertas...</p>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No hay alertas para mostrar</h3>
              <p className="mt-1 text-sm text-muted-foreground">Intenta generar nuevas alertas o ajustar los filtros.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.vehiclePlateNumber || a.vehicleId}</TableCell>
                    <TableCell>{formatType(a.alertType)}</TableCell>
                    <TableCell>{a.message}</TableCell>
                    <TableCell>{a.dueDate || "N/D"}</TableCell>
                    <TableCell>{a.status}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {a.status === "Nueva" && (
                        <Button variant="outline" size="sm" onClick={() => markStatus(a.id, "Vista")} disabled={working}>
                          <Eye className="mr-2 h-4 w-4" /> Marcar vista
                        </Button>
                      )}
                      {a.status !== "Resuelta" && (
                        <Button variant="default" size="sm" onClick={() => markStatus(a.id, "Resuelta")} disabled={working}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Resolver
                        </Button>
                      )}
                    </TableCell>
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

function formatType(t: Alert["alertType"]) {
  switch (t) {
    case "PreventiveMaintenanceDue":
      return "Mantenimiento Preventivo Próximo";
    case "DocumentExpiry":
      return "Documento por Vencer";
    case "LowMileageEfficiency":
      return "Baja Eficiencia de Combustible";
    case "HighMaintenanceCost":
      return "Costo de Mantenimiento Alto";
    default:
      return t;
  }
}
