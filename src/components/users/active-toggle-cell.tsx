"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type ActiveToggleCellProps = {
  active: boolean;
  userId?: string; // prefer API when present
  action: (formData: FormData) => void | Promise<void>; // server action bound with userId & nextActive
};

export default function ActiveToggleCell({ active, userId, action }: ActiveToggleCellProps) {
  const [localActive, setLocalActive] = React.useState(active);
  const [open, setOpen] = React.useState(false);
  const [queuedNext, setQueuedNext] = React.useState<boolean | null>(null);
  const [mode, setMode] = React.useState<"activar" | "desactivar">("desactivar");
  const formRef = React.useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => { setLocalActive(active); }, [active]);

  const onToggleChange = async (next: boolean) => {
    // Always confirm both actions per request
    setQueuedNext(next);
    setMode(next ? "activar" : "desactivar");
    setOpen(true);
  };

  const submitChange = async (nextActive: boolean) => {
    // Optimistic UI
    const previous = localActive;
    setLocalActive(nextActive);
    try {
      // Try API first for faster UX; form action fallback remains
      const form = formRef.current;
      const formUserId = userId ?? form?.getAttribute('data-user-id') ?? undefined;
      if (formUserId) {
        const res = await fetch(`/api/users/${encodeURIComponent(formUserId)}/active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: nextActive }),
        });
        if (!res.ok) throw new Error('API error');
      } else {
        formRef.current?.requestSubmit();
      }
      toast({ title: nextActive ? 'Usuario activado' : 'Usuario desactivado' });
      // Ensure server components reflect latest state (badge updates)
      router.refresh();
    } catch (err) {
      // Rollback on error
      setLocalActive(previous);
      toast({ title: 'No se pudo aplicar el cambio', variant: 'destructive' });
    }
  };

  const confirmAction = async () => {
    setOpen(false);
    if (queuedNext !== null) {
      await submitChange(queuedNext);
    }
    setQueuedNext(null);
  };

  return (
    <>
      <form ref={formRef} action={action} className="inline-flex items-center" data-user-id={userId}
      >
        <Switch checked={localActive} onCheckedChange={onToggleChange} />
      </form>
      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQueuedNext(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === 'activar' ? 'Activar usuario' : 'Desactivar usuario'}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'activar'
                ? 'Al activar, el usuario podrá iniciar sesión nuevamente. ¿Deseas continuar?'
                : 'Al desactivar, el usuario no podrá iniciar sesión y las sesiones activas serán cerradas. ¿Deseas continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <button type="button">Cancelar</button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <button type="button" onClick={confirmAction}>{mode === 'activar' ? 'Activar' : 'Desactivar'}</button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
