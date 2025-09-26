"use client";

import { Button } from "@/components/ui/button";
// Removed single-select in favor of multi-select
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
import { VehicleMultiSelect } from "@/components/vehicles/vehicle-multi-select";

export type FuelingFiltersProps = {
  vehicles: Vehicle[];
  selectedVehicleIds?: string[];
  from?: string; // yyyy-MM-dd
  to?: string;   // yyyy-MM-dd
};

export default function FuelingFilters({ vehicles, selectedVehicleIds, from, to }: FuelingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedIds, setSelectedIds] = React.useState<string[]>(selectedVehicleIds ?? []);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (from || to) {
      const parseLocal = (s: string) => {
        const [yy, mm, dd] = s.split("-").map(n => parseInt(n, 10));
        return new Date(yy, (mm || 1) - 1, dd || 1);
      };
      const f = from ? parseLocal(from) : undefined;
      const t = to ? parseLocal(to) : undefined;
      return { from: f, to: t };
    }
    // Default to "Este mes"
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });

  // On first mount, if no from/to were provided via props, reflect default range in URL
  React.useEffect(() => {
    if (!from && !to && dateRange?.from && dateRange?.to) {
      pushWith(selectedIds, dateRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushWith = React.useCallback((ids: string[], range?: DateRange) => {
    const params = new URLSearchParams();
    if (ids && ids.length > 0 && ids.length < vehicles.length) {
      params.set("vehicleIds", ids.join(","));
    }
    if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"));
    if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, vehicles.length]);

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
    pushWith(selectedIds, newRange);
  };

  const handleVehicleChange = (ids: string[]) => {
    setSelectedIds(ids);
    pushWith(ids, dateRange);
  };

  const handleRangeSelect = (range?: DateRange) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      pushWith(selectedIds, range);
    }
  };

  return (
    <div className="hidden md:flex items-center gap-2">
      <div className="min-w-[220px]">
        <VehicleMultiSelect
          vehicles={vehicles}
          selectedIds={selectedIds}
          onChange={handleVehicleChange}
          buttonLabel="Vehículos"
        />
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
