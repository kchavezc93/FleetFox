"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarDays } from "lucide-react";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Vehicle } from "@/types";

export type MaintenanceFiltersProps = {
  vehicles: Vehicle[];
  selectedVehicleId?: string;
  from?: string; // yyyy-MM-dd
  to?: string;   // yyyy-MM-dd
};

export default function MaintenanceFilters({ vehicles, selectedVehicleId, from, to }: MaintenanceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [vehicleId, setVehicleId] = React.useState<string>(selectedVehicleId ?? "all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (from || to) {
      const f = from ? new Date(from + "T00:00:00Z") : undefined;
      const t = to ? new Date(to + "T00:00:00Z") : undefined;
      return { from: f, to: t };
    }
    return undefined;
  });

  const pushWith = React.useCallback((vid: string, range?: DateRange) => {
    const params = new URLSearchParams();
    if (vid && vid !== "all") params.set("vehicleId", vid);
    if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"));
    if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router]);

  const applyPreset = (preset: string) => {
    const today = new Date();
    let f = today; let t = today;
    switch (preset) {
      case "last7": f = subDays(today, 6); break;
      case "last30": f = subDays(today, 29); break;
      case "last90": f = subDays(today, 89); break;
      case "thisMonth": f = startOfMonth(today); t = endOfMonth(today); break;
      case "lastMonth": {
        const prev = subMonths(today, 1);
        f = startOfMonth(prev); t = endOfMonth(prev); break;
      }
      case "ytd": f = startOfYear(today); break;
    }
    const newRange = { from: f, to: t } as DateRange;
    setDateRange(newRange);
    pushWith(vehicleId, newRange);
  };

  const handleVehicleChange = (val: string) => {
    setVehicleId(val);
    pushWith(val, dateRange);
  };

  const handleRangeSelect = (range?: DateRange) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      pushWith(vehicleId, range);
    }
  };

  return (
    <div className="hidden md:flex items-center gap-2">
      <div className="min-w-[220px]">
        <Select value={vehicleId} onValueChange={handleVehicleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los vehículos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vehículos</SelectItem>
            {vehicles.map(v => (
              <SelectItem key={v.id} value={v.id}>{v.plateNumber} ({v.brand} {v.model})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start">
            <CalendarDays className="mr-2 h-4 w-4" />
            {dateRange?.from && dateRange?.to
              ? `${format(dateRange.from, "P", { locale: es })} - ${format(dateRange.to, "P", { locale: es })}`
              : "dd/mm/aaaa"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={dateRange}
            onSelect={handleRangeSelect}
            defaultMonth={dateRange?.from}
            locale={es}
          />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Rangos rápidos</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => applyPreset("last7")}>Últimos 7 días</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset("last30")}>Últimos 30 días</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset("last90")}>Últimos 90 días</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset("thisMonth")}>Este mes</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset("lastMonth")}>Mes anterior</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset("ytd")}>Año en curso (YTD)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
