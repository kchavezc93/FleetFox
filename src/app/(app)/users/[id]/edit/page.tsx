import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { UserForm } from "@/components/user-form";
import { getUserById, saveUser } from "@/lib/actions/user-actions";

type Params = { params: { id: string } };

export default async function EditUserPage({ params }: Params) {
  const user = await getUserById(params.id);

  async function submit(data: any) {
    "use server";
    // Preserve existing fields but allow updates; password is optional
    return saveUser({
      email: data.email,
      username: data.username,
      fullName: data.fullName,
      role: data.role,
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      active: !!data.active,
      password: data.password || undefined,
    } as any, params.id);
  }

  return (
    <>
      <PageHeader
        title="Editar Usuario"
        description="Actualiza la información de la cuenta y sus permisos."
        icon={Users}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <UserForm
            mode="edit"
            initial={user || undefined}
            onSubmitAction={submit as any}
          />
        </CardContent>
      </Card>
    </>
  );
}
