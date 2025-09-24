"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";

export type MaintenanceExportRow = {
  vehiclePlateNumber: string;
  maintenanceType: string;
  executionDate: string; // YYYY-MM-DD
  mileageAtService: number;
  cost: number;
  provider?: string;
  createdBy?: string;
  updatedBy?: string;
};

export function MaintenanceExportButtons({ rows }: { rows: MaintenanceExportRow[] }) {
  const handleExportXLSX = async () => {
    if (!rows.length) return;
    await exportToXLSX({
      rows: rows.map(r => ({
        plate: r.vehiclePlateNumber,
        type: r.maintenanceType,
        date: r.executionDate,
        mileage: r.mileageAtService,
        cost: Number(r.cost.toFixed(2)),
        provider: r.provider ?? "",
        createdBy: r.createdBy ?? "",
        updatedBy: r.updatedBy ?? "",
      })),
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "type", header: "Tipo" },
        { key: "date", header: "Fecha", format: "date" },
        { key: "mileage", header: "Kilometraje", format: "integer" },
        { key: "cost", header: "Costo (C$)", format: "currency", numFmt: "[$C$ ]#,##0.00" },
        { key: "provider", header: "Proveedor" },
        { key: "createdBy", header: "Creado por" },
        { key: "updatedBy", header: "Actualizado por" },
      ],
    }, "mantenimiento", "Mantenimiento");
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
