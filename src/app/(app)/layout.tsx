
import { Header } from "@/components/layout/header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarInset,
  SidebarHeader as UISidebarHeader,
  SidebarFooter as UISidebarFooter,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image"; 
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDbClient } from "@/lib/db";
import sql from 'mssql';

// PRODUCCIÓN: Consideraciones de Seguridad para el Layout de la Aplicación
// 1. Protección de Rutas:
//    Este layout envuelve las páginas autenticadas de la aplicación. En un entorno de producción,
//    necesitarías verificar si el usuario está autenticado ANTES de renderizar este layout.
//    Esto se puede lograr de varias maneras:
//    a) Middleware (recomendado para App Router): Crear un archivo `middleware.ts` en la raíz del proyecto
//       o en `src/` para interceptar las solicitudes a las rutas bajo `/app/(app)/`,
//       verificar la sesión (ej. cookie de sesión) y redirigir a `/login` si no está autenticado.
//    b) Verificación en el Layout del Servidor: Aunque el middleware es preferido, podrías
//       intentar leer la sesión aquí (ej. `cookies().get('session_token')`) y redirigir.
//       Sin embargo, esto puede ser menos eficiente y más propenso a errores.
// 2. Carga de Datos del Usuario:
//    Si la sesión es válida, aquí podrías cargar los datos básicos del usuario (nombre, rol)
//    desde la base de datos (basado en el ID de usuario de la sesión) para pasarlos
//    a componentes hijos, como el Header, si es necesario.
// 3. Gestión de Roles y Permisos (Granular):
//    Mientras que el middleware puede proteger el acceso general a esta sección `/app/(app)/`,
//    la visibilidad/accesibilidad de elementos específicos dentro de las páginas (ej. botones de "Editar"
//    vs "Ver", acceso a ciertas sub-secciones del menú) debería ser controlada por el rol
//    y los permisos del usuario, que se cargarían desde la sesión/BD.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Validación fuerte de sesión en el servidor (tras el middleware ligero)
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) {
    redirect('/login');
  }

  const dbClient = await getDbClient();
  if (!(dbClient?.type === 'SQLServer') || !(dbClient as any).pool) {
    redirect('/login');
  }

  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const req = pool.request();
  req.input('token', sql.NVarChar(128), token);
  const result = await req.query(`
    SELECT s.token, s.expiresAt, u.id as userId, u.username, u.email, u.role, u.permissions
    FROM sessions s
    JOIN users u ON u.id = s.userId
    WHERE s.token = @token
  `);
  if (!result.recordset.length) {
    redirect('/login');
  }
  const row = result.recordset[0];
  if (new Date(row.expiresAt) < new Date()) {
    const del = pool.request();
    del.input('token', sql.NVarChar(128), token);
    await del.query('DELETE FROM sessions WHERE token = @token');
    redirect('/login');
  }

  const session = {
    user: {
      id: row.userId?.toString?.() ?? String(row.userId),
      username: row.username,
      email: row.email,
      role: row.role as 'Admin' | 'Standard',
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
    }
  } as const;
  const companyName = (process as any)?.env?.NEXT_PUBLIC_COMPANY_NAME ?? "Dos Robles";
  const companyLogoUrl = (process as any)?.env?.NEXT_PUBLIC_COMPANY_LOGO_URL;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar" className="border-r">
        <UISidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-primary">
            {companyLogoUrl ? (
              <Image
                src={companyLogoUrl}
                alt={`Logo de ${companyName}`}
                width={28} 
                height={28}
                className="object-contain" 
                data-ai-hint="company logo"
              />
            ) : (
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="text-primary"
                aria-label="Logo genérico"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            )}
            <span className="group-data-[collapsible=icon]:hidden">{companyName}</span>
          </Link>
        </UISidebarHeader>
        <SidebarContent className="p-0">
          <ScrollArea className="h-full">
            {/* PRODUCCIÓN: El componente SidebarNav podría recibir los permisos del usuario
                para renderizar dinámicamente solo los ítems a los que tiene acceso. */}
            <SidebarNav userRole={session.user.role} userPermissions={session.user.permissions} />
          </ScrollArea>
        </SidebarContent>
        <UISidebarFooter className="p-4 border-t">
          {/* Footer content if any, e.g. user info or quick links */}
           <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">© {new Date().getFullYear()} {companyName}</p>
        </UISidebarFooter>
      </Sidebar>
      <SidebarInset>
        {/* PRODUCCIÓN: El Header podría recibir datos del usuario (ej. nombre) para mostrar. */}
  <Header /* userData={session.user} */ />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
