"use client";

import * as React from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type Props = React.ComponentProps<typeof DropdownMenuItem> & {
  confirmMessage: string;
};

export function ConfirmSubmitMenuItem({ confirmMessage, className, children, ...rest }: Props) {
  const onSelect = (e: Event) => {
    // Prevent the menu from closing before we process confirmation
    e.preventDefault();
    const ok = typeof window !== 'undefined' ? window.confirm(confirmMessage) : true;
    if (!ok) return;
    // Submit the closest form
    const target = e.target as HTMLElement | null;
    const form = target?.closest('form') as HTMLFormElement | null;
    form?.requestSubmit();
  };
  return (
    <DropdownMenuItem
      onSelect={onSelect as any}
      className={["text-red-600 focus:bg-red-50 focus:text-red-700", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </DropdownMenuItem>
  );
}
