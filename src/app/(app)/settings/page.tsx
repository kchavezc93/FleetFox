
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Palette, Database } from "lucide-react"; // Database icon
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
