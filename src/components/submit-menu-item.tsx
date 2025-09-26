"use client";

import * as React from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// A helper for non-destructive actions that simply submit the closest form and (optionally) show a toast.
// Usage: wrap inside a <form action={...}>; clicking will submit that form.
export function SubmitMenuItem({
  children,
  className,
  successToastTitle,
  successToastDescription,
  ...rest
}: React.ComponentProps<typeof DropdownMenuItem> & {
  successToastTitle?: string;
  successToastDescription?: string;
}) {
  const { toast } = useToast();
  return (
    <DropdownMenuItem
      onSelect={(e) => e.preventDefault()}
      className={className}
      {...rest}
      onClick={(e) => {
        if (successToastTitle) {
          toast({ title: successToastTitle, description: successToastDescription });
        }
        const target = (e.target as HTMLElement) || null;
        const form = target?.closest("form") as HTMLFormElement | null;
        form?.requestSubmit();
      }}
    >
      {children}
    </DropdownMenuItem>
  );
}
