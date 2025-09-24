"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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

type ActiveToggleCellProps = {
  active: boolean;
  action: (formData: FormData) => void | Promise<void>; // server action bound with userId & nextActive
};

export default function ActiveToggleCell({ active, action }: ActiveToggleCellProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (active) {
      setOpen(true);
    } else {
      formRef.current?.requestSubmit();
    }
  };

  const confirmDeactivate = () => {
    setOpen(false);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={action} className="inline-flex items-center">
        <Switch checked={active} onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()} />
        <Button type="submit" variant="outline" size="sm" className="ml-2" onClick={handleSubmit}>
          Guardar
        </Button>
      </form>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desactivar usuario
            </AlertDialogTitle>
            <AlertDialogDescription>
              Al desactivar, el usuario no podrá iniciar sesión y las sesiones activas serán cerradas. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <button type="button">Cancelar</button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <button type="button" onClick={confirmDeactivate}>Desactivar</button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
