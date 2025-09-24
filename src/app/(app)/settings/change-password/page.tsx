"use client";

import { PageHeader } from "@/components/page-header";
import { KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { changeOwnPassword } from "@/lib/actions/auth-actions";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await changeOwnPassword({ currentPassword, newPassword, confirmPassword });
    if (res.success) {
      setSuccess(res.message);
      setCurrent(""); setNew(""); setConfirm("");
      // Optionally redirect to login after a short delay
      setTimeout(() => router.push("/auth/login"), 1200);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }

  return (
    <>
      <PageHeader
        title="Cambiar Contraseña"
        description="Actualiza tu contraseña de acceso. Se cerrarán tus sesiones activas."
        icon={KeyRound}
      />
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña actual</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
              <Input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={6} />
              <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar nueva contraseña</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
