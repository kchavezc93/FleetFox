
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
// Image import no longer needed here
// import Image from "next/image"; 

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // PRODUCCIÓN: Ejemplo conceptual de cómo se podría obtener la sesión (reemplazar con tu lógica real)
  // const session = await getSession(); // Función hipotética para obtener la sesión
  // if (!session) {
  //   redirect('/login'); // Si no hay sesión, redirigir a login
  // }
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Dos Robles";
  // companyLogoUrl is no longer used.

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar" className="border-r">
        <UISidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center text-lg font-semibold text-primary">
            {/* Logo completamente eliminado. Solo el nombre de la empresa. */}
            <span className="group-data-[collapsible=icon]:hidden">{companyName}</span>
            {/* Si el span anterior causa problemas de colapso, se puede simplificar a solo: */}
            {/* <span className={cn(open ? "" : "hidden")}>{companyName}</span> */}
            {/* O incluso más simple si el colapso se maneja solo con el grupo: */}
            {/* {companyName} */} 
          </Link>
        </UISidebarHeader>
        <SidebarContent className="p-0">
          <ScrollArea className="h-full">
            {/* PRODUCCIÓN: El componente SidebarNav podría recibir los permisos del usuario
                para renderizar dinámicamente solo los ítems a los que tiene acceso. */}
            <SidebarNav /* userPermissions={session.user.permissions} */ />
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
