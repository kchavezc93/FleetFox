
import { PageHeader } from "@/components/page-header";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getUsers, saveUser, deleteUser } from "@/lib/actions/user-actions";
import ActiveToggleCell from "@/components/users/active-toggle-cell";
import { requirePermission } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { UsersExportButtons } from "@/components/users-export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
          <div className="flex gap-2">
            <UsersExportButtons
              rows={users.map(u => ({
                username: u.username,
                email: u.email,
                role: u.role,
                active: (u as any).active ?? true,
                createdAt: (u as any).createdAt ?? undefined,
                updatedAt: (u as any).updatedAt ?? undefined,
              }))}
            />
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/users/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Usuario
              </Link>
            </Button>
          </div>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/users/${u.id}/edit`}>Editar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <form action={async () => { "use server"; await deleteUser(u.id); }}>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button type="button" className="w-full text-left text-red-600">Eliminar</button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción eliminará al usuario de forma permanente y cerrará sus sesiones activas. ¿Deseas continuar?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction asChild>
                                        <button type="submit" className="text-red-600">Eliminar</button>
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </form>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
