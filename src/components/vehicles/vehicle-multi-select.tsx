"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Vehicle } from "@/types";

type Props = {
  vehicles: Vehicle[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  buttonLabel?: string;
};

export function VehicleMultiSelect({ vehicles, selectedIds, onChange, buttonLabel = "Vehículos" }: Props) {
  const [open, setOpen] = React.useState(false);
  const allSelected = selectedIds.length > 0 && selectedIds.length === vehicles.length;

  const toggleOne = (id: string) => {
    const exists = selectedIds.includes(id);
    onChange(exists ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(vehicles.map(v => v.id));

  const base = buttonLabel || "Vehículos";
  const label = selectedIds.length === 0
    ? "Todos los vehículos"
    : allSelected
      ? "Todos los vehículos"
      : `${base}: ${selectedIds.length}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start min-w-[220px] h-10">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <button className="text-xs text-muted-foreground hover:underline" onClick={selectAll}>Seleccionar todo</button>
          <button className="text-xs text-muted-foreground hover:underline" onClick={clearAll}>Limpiar</button>
        </div>
        <ScrollArea className="h-60">
          <div className="p-2 space-y-2">
            {vehicles.map(v => (
              <label key={v.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={selectedIds.includes(v.id)} onCheckedChange={() => toggleOne(v.id)} />
                <span>{v.plateNumber} ({v.brand} {v.model})</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t text-right">
          <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
