"use client";

import { PageHeader } from "@/components/page-header";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { getAuditEvents } from "@/lib/actions/audit-actions";
import type { AuditEvent } from "@/types";

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setEvents(await getAuditEvents(200)); } finally { setLoading(false); }
    })();
  }, []);
  return (
    <>
      <PageHeader title="Registro de Auditoría" description="Eventos de seguridad y administración." icon={ListChecks} />
      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes</CardTitle>
          <CardDescription>Últimos eventos registrados en el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : events.length === 0 ? (
            <p className="text-muted-foreground">Sin eventos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{e.eventType}</TableCell>
                    <TableCell>{e.actorUsername || e.actorUserId || '-'}</TableCell>
                    <TableCell>{e.targetUsername || e.targetUserId || '-'}</TableCell>
                    <TableCell>{e.message || '-'}</TableCell>
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
