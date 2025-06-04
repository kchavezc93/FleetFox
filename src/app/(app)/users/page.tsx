
import { PageHeader } from "@/components/page-header";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default function UserManagementPage() {
  return (
    <>
      <PageHeader
        title="Gestión de Usuarios"
        description="Administra los usuarios y sus roles en la plataforma."
        icon={Users}
        actions={
          // <Link href="/users/new"> // Deshabilitado hasta que se implemente el formulario de nuevo usuario
            <Button className="bg-primary hover:bg-primary/90" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Usuario
            </Button>
          // </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Usuarios</CardTitle>
          <CardDescription>
            Esta sección mostrará los usuarios registrados. (Funcionalidad pendiente de implementación)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No hay usuarios para mostrar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              La funcionalidad de gestión de usuarios y la conexión a una tabla de usuarios en la base de datos necesitan ser implementadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
