"use client";

import * as React from "react";
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

type Props = React.ComponentProps<typeof Button> & {
  confirmMessage: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  successToastTitle?: string;
  successToastDescription?: string;
};

import { useToast } from "@/hooks/use-toast";

export function ConfirmSubmitButton({ confirmMessage, children, title = "Confirmar acción", confirmLabel = "Confirmar", cancelLabel = "Cancelar", successToastTitle, successToastDescription, ...rest }: Props) {
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement | null>(null);
  // We render a hidden submit to hook the actual form submission
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" {...rest}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              if (successToastTitle) {
                toast({ title: successToastTitle, description: successToastDescription });
              }
              // Find nearest form and submit
              const target = (e.target as HTMLElement) || null;
              const form = target?.closest("form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
