"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & {
  confirmMessage: string;
};

export function ConfirmSubmitButton({ confirmMessage, children, ...rest }: Props) {
  const onClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    // Only confirm on actual left-click/Enter submits
    const ok = typeof window !== 'undefined' ? window.confirm(confirmMessage) : true;
    if (!ok) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  return (
    <Button type="submit" onClick={onClick} {...rest}>
      {children}
    </Button>
  );
}
