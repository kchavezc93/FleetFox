"use client";

import * as React from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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

type Props = React.ComponentProps<typeof DropdownMenuItem> & {
  confirmMessage: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmSubmitMenuItem({ confirmMessage, className, children, title = "Confirmar acción", confirmLabel = "Confirmar", cancelLabel = "Cancelar", ...rest }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          // Prevent default close; dialog will open
          onSelect={(e) => e.preventDefault()}
          className={["text-red-600 focus:bg-red-50 focus:text-red-700", className].filter(Boolean).join(" ")}
          {...rest}
        >
          {children}
        </DropdownMenuItem>
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
