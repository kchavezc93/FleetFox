
import { PageHeader } from "@/components/page-header";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getUsers, saveUser } from "@/lib/actions/user-actions";
import ActiveToggleCell from "@/components/users/active-toggle-cell";
import { requirePermission } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";

export default async function UserManagementPage() {
  await requirePermission('/users');
  const users = await getUsers();

  async function toggleActive(userId: string, nextActive: boolean) {
    "use server";
    // Cargar datos actuales para conservar todo salvo 'active'
    const all = await getUsers();
    const target = all.find(u => u.id === userId);
    if (!target) return;
    await saveUser({
      email: target.email,
      username: target.username,
      fullName: target.fullName,
      role: target.role,
      permissions: target.permissions,
      active: nextActive,
    } as any, userId);
  }

  return (
    <>
      <PageHeader
        title="Gestión de Usuarios"
        description="Administra los usuarios y sus roles en la plataforma."
        icon={Users}
        actions={
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/users/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Usuario
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Usuarios</CardTitle>
          <CardDescription>Activa o desactiva accesos rápidamente.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No hay usuarios para mostrar</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Usuario</th>
                    <th className="py-2 pr-4">Correo</th>
                    <th className="py-2 pr-4">Rol</th>
                    <th className="py-2 pr-4">Activo</th>
                    <th className="py-2 pr-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2 pr-4">{u.username}</td>
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant="secondary"
                          className={u.role === "Admin" ? "bg-violet-600 text-white" : ""}
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={((u as any).active ?? true) ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}
                          >
                            {((u as any).active ?? true) ? "Activo" : "Inactivo"}
                          </Badge>
                          <ActiveToggleCell
                            active={(u as any).active ?? true}
                            action={toggleActive.bind(null, u.id, !((u as any).active ?? true))}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/users/${u.id}/edit`}>Editar</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
