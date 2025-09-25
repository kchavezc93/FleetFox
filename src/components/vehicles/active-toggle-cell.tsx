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

export type VehicleActiveToggleCellProps = {
  active: boolean;
  vehicleId: string;
  action: (formData: FormData) => void | Promise<void>; // server action bound with vehicleId & nextActive
};

export default function VehicleActiveToggleCell({ active, vehicleId, action }: VehicleActiveToggleCellProps) {
  const [localActive, setLocalActive] = React.useState(active);
  const [open, setOpen] = React.useState(false);
  const [queuedNext, setQueuedNext] = React.useState<boolean | null>(null);
  const [mode, setMode] = React.useState<"activar" | "desactivar">("desactivar");
  const formRef = React.useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => { setLocalActive(active); }, [active]);

  const onToggleChange = async (next: boolean) => {
    setQueuedNext(next);
    setMode(next ? "activar" : "desactivar");
    setOpen(true);
  };

  const confirmAction = async () => {
    setOpen(false);
    if (queuedNext === null) return;
    const previous = localActive;
    // Optimistic UI
    setLocalActive(queuedNext);
    try {
      // Fallback to server action form submit (no API route required)
      formRef.current?.requestSubmit();
      toast({ title: queuedNext ? "Vehículo activado" : "Vehículo marcado como inactivo" });
      router.refresh();
    } catch (err) {
      setLocalActive(previous);
      toast({ title: "No se pudo aplicar el cambio", variant: "destructive" });
    } finally {
      setQueuedNext(null);
    }
  };

  return (
    <>
      <form ref={formRef} action={action} className="inline-flex items-center" data-vehicle-id={vehicleId}>
        <Switch checked={localActive} onCheckedChange={onToggleChange} />
      </form>
      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQueuedNext(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === 'activar' ? 'Activar vehículo' : 'Desactivar vehículo'}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'activar'
                ? 'Al activar, el vehículo volverá a estado Activo. ¿Deseas continuar?'
                : 'Al desactivar, el vehículo pasará a estado Inactivo. ¿Deseas continuar?'}
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
