"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Palette, Database, SlidersHorizontal } from "lucide-react"; // Database icon
// Removed DbConnectionForm and related imports as DB config is now via .env
import { ThemeSwitcher } from "@/components/theme-switcher";
// Removed: import React, { useEffect, useState } from "react";
// Removed: import { loadDbConnectionSettings } from "@/lib/actions/settings-actions"; // This action will be removed
// Removed: import { Loader2 } from "lucide-react";
// Removed: import type { DbConnectionSchema } from "@/lib/zod-schemas";


export default function SettingsPage() {
  // const [dbSettings, setDbSettings] = useState<DbConnectionSchema | null>(null); // No longer needed
  // const [isLoadingDbSettings, setIsLoadingDbSettings] = useState(true); // No longer needed

  // useEffect(() => { // No longer needed
  //   async function fetchSettings() {
  //     setIsLoadingDbSettings(true);
  //     // const settings = await loadDbConnectionSettings(); // This function will be removed or internal to db.ts
  //     // setDbSettings(settings);
  //     setIsLoadingDbSettings(false);
  //   }
  //   fetchSettings();
  // }, []);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Gestiona la configuración y preferencias de tu aplicación."
        icon={SettingsIcon}
      />
      <div className="grid gap-6">
        <VoucherLimitCard />
        <AlertThresholdsCard />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/> Configuración de Conexión a Base de Datos</CardTitle>
            <CardDescription>
              La configuración de la conexión a la base de datos ahora se gestiona a través de variables de entorno.
              Por favor, consulta el archivo <code>.env.example</code> para ver las variables requeridas
              (<code>DB_HOST</code>, <code>DB_PORT</code>, <code>DB_USER</code>, <code>DB_PASSWORD</code>, <code>DB_NAME</code>, <code>DB_TYPE</code>).
              Para desarrollo local, puedes crear un archivo <code>.env</code> basado en <code>.env.example</code>.
              En producción, estas variables deben ser configuradas de forma segura en tu plataforma de hosting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* El formulario para configurar la BD desde la UI ha sido eliminado. */}
            <p className="text-sm text-muted-foreground">
              La conexión a la base de datos se establece utilizando las variables de entorno definidas para el proyecto.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Configuración del Tema</CardTitle>
            <CardDescription>Personaliza la apariencia de la aplicación seleccionando un tema.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSwitcher />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card as CardBase } from "@/components/ui/card";
// Client components should call an API route instead of server actions directly
// Server actions remain the single source of truth behind the API
// import { loadAlertThresholdsAction, saveAlertThresholdsAction } from "@/lib/actions/settings-actions";
import { useToast } from "@/hooks/use-toast";

function VoucherLimitCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState<number>(2);
  const { toast } = useToast();
  useEffect(() => { (async () => {
    setLoading(true);
    const res = await fetch("/api/settings/voucher-limit", { cache: "no-store" });
    const s = res.ok ? await res.json() : null;
    if (s && s.voucherMaxPerFueling != null) setValue(Number(s.voucherMaxPerFueling));
    setLoading(false);
  })(); }, []);
  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/voucher-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherMaxPerFueling: Number(value) })
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const d = json?.data;
      if (d && d.voucherMaxPerFueling != null) setValue(Number(d.voucherMaxPerFueling));
      toast({ title: "Límite guardado", description: "El máximo de vouchers por registro fue actualizado." });
    } else {
      toast({ title: "No se pudo guardar", description: "Revisa la conexión o la existencia de la columna en settings.", variant: "destructive" });
    }
    setSaving(false);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5"/> Límite de Vouchers</CardTitle>
        <CardDescription>Máximo de vouchers por registro de combustible (servidor).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {loading ? <p className="text-muted-foreground">Cargando...</p> : (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Máximo por registro</label>
              <Input type="number" min={1} value={value} onChange={e => setValue(Number(e.target.value))} />
            </div>
            <div className="flex items-end justify-end">
              <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AlertThresholdsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ days: 30, km: 2000, lowEff: 10, highMaint: 20000, windowDays: 30 });
  const { toast } = useToast();
  useEffect(() => { (async () => {
    setLoading(true);
    const res = await fetch("/api/settings/thresholds", { cache: "no-store" });
    const s = res.ok ? await res.json() : null;
    if (s) setForm({ days: s.daysThreshold ?? 30, km: s.mileageThreshold ?? 2000, lowEff: s.lowEfficiencyThresholdKmPerGallon ?? 10, highMaint: s.highMaintenanceCostThreshold ?? 20000, windowDays: s.maintenanceCostWindowDays ?? 30 });
    setLoading(false);
  })(); }, []);
  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/thresholds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daysThreshold: Number(form.days),
        mileageThreshold: Number(form.km),
        lowEfficiencyThresholdKmPerGallon: Number(form.lowEff),
        highMaintenanceCostThreshold: Number(form.highMaint),
        maintenanceCostWindowDays: Number(form.windowDays),
      }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const d = json?.data;
      if (d) {
        setForm({
          days: d.daysThreshold ?? form.days,
          km: d.mileageThreshold ?? form.km,
          lowEff: d.lowEfficiencyThresholdKmPerGallon ?? form.lowEff,
          highMaint: d.highMaintenanceCostThreshold ?? form.highMaint,
          windowDays: d.maintenanceCostWindowDays ?? form.windowDays,
        });
      } else {
        // Fallback: refetch
        const ref = await fetch("/api/settings/thresholds", { cache: "no-store" });
        if (ref.ok) {
          const s = await ref.json();
          setForm({ days: s.daysThreshold ?? 30, km: s.mileageThreshold ?? 2000, lowEff: s.lowEfficiencyThresholdKmPerGallon ?? 10, highMaint: s.highMaintenanceCostThreshold ?? 20000, windowDays: s.maintenanceCostWindowDays ?? 30 });
        }
      }
      toast({ title: "Umbrales guardados", description: "Los cambios fueron aplicados correctamente." });
    } else {
      toast({ title: "No se pudo guardar", description: "Revisa la conexión a la BD o inténtalo más tarde.", variant: "destructive" });
    }
    setSaving(false);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5"/> Umbrales de Alertas</CardTitle>
        <CardDescription>Ajusta los umbrales usados por el motor de alertas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-5">
        {loading ? <p className="text-muted-foreground">Cargando...</p> : (
          <>
            <div>
              <label className="block text-sm mb-1">Días (próximo mantenimiento)</label>
              <Input type="number" value={form.days} onChange={e => setForm({ ...form, days: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Km (próximo mantenimiento)</label>
              <Input type="number" value={form.km} onChange={e => setForm({ ...form, km: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Eficiencia baja (km/gal)</label>
              <Input type="number" step="0.1" value={form.lowEff} onChange={e => setForm({ ...form, lowEff: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Costo alto (C$)</label>
              <Input type="number" step="0.01" value={form.highMaint} onChange={e => setForm({ ...form, highMaint: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Ventana días costos</label>
              <Input type="number" value={form.windowDays} onChange={e => setForm({ ...form, windowDays: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
