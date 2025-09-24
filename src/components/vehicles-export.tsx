"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";

export type VehicleExportRow = {
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  fuelType: string;
  currentMileage: number;
  status: string;
  nextPreventiveMaintenanceDate?: string; // YYYY-MM-DD
  nextPreventiveMaintenanceMileage?: number;
};

export function VehiclesExportButtons({ rows }: { rows: VehicleExportRow[] }) {
  const handleExportXLSX = async () => {
    if (!rows.length) return;
    await exportToXLSX({
      rows: rows.map(r => ({
        plate: r.plateNumber,
        brand: r.brand,
        model: r.model,
        year: r.year,
        fuel: r.fuelType,
        mileage: r.currentMileage,
        status: r.status,
        nextDate: r.nextPreventiveMaintenanceDate ?? "",
        nextKm: r.nextPreventiveMaintenanceMileage ?? null,
      })),
      columns: [
        { key: "plate", header: "Matrícula", width: 16 },
        { key: "brand", header: "Marca", width: 16 },
        { key: "model", header: "Modelo", width: 18 },
        { key: "year", header: "Año", format: "integer" },
        { key: "fuel", header: "Combustible" },
        { key: "mileage", header: "Kilometraje", format: "integer" },
        { key: "status", header: "Estado" },
        { key: "nextDate", header: "Próx. Mant. (Fecha)", format: "date" },
        { key: "nextKm", header: "Próx. Mant. (Km)", format: "integer" },
      ],
    }, "vehiculos", "Vehículos");
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="default"
        className="bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={handleExportXLSX}
        disabled={!rows.length}
      >
        <FileDown className="mr-2 h-4 w-4" /> Excel (XLSX)
      </Button>
    </div>
  );
}
