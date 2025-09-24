import { PageHeader } from "@/components/page-header";
import { UserForm } from "@/components/user-form";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { saveUser } from "@/lib/actions/user-actions";

export default function NewUserPage() {
  return (
    <>
      <PageHeader
        title="Agregar Usuario"
        description="Crea una cuenta nueva y define su rol."
        icon={Users}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <UserForm mode="create" onSubmitAction={saveUser as any} />
        </CardContent>
      </Card>
    </>
  );
}
