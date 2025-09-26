"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";

type FuelingRow = {
  plate: string;
  date: string; // YYYY-MM-DD
  mileage: number;
  gallons: number;
  cpg: number; // cost per gallon
  total: number;
  efficiency?: number | null;
  station: string;
};

export function FuelingExportButtons({ rows }: { rows: FuelingRow[] }) {
  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = [
      "Vehículo (Matrícula)",
      "Fecha",
  "Kilometraje",
      "Galones",
      "Costo/Galón (C$)",
      "Costo Total (C$)",
      "Eficiencia (km/gal)",
      "Estación",
    ];
    const csvRows = [headers.join(",")];
    for (const r of rows) {
      csvRows.push([
        r.plate,
        r.date,
        r.mileage.toString(),
        r.gallons.toFixed(2),
        r.cpg.toFixed(2),
        r.total.toFixed(2),
        r.efficiency != null ? r.efficiency.toFixed(1) : "",
        r.station.replace(/\"/g, '"'),
      ].join(","));
    }
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "registros_combustible.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportXLSX = async () => {
    if (!rows.length) return;
    await exportToXLSX({
      rows: rows.map((r) => ({
        plate: r.plate,
        date: r.date,
        mileage: r.mileage,
        gallons: Number(r.gallons.toFixed(2)),
        cpg: Number(r.cpg.toFixed(2)),
        total: Number(r.total.toFixed(2)),
        efficiency: r.efficiency != null ? Number(r.efficiency.toFixed(1)) : null,
        station: r.station,
      })),
      columns: [
        { key: "plate", header: "Vehículo (Matrícula)", width: 18 },
        { key: "date", header: "Fecha", format: "date" },
  { key: "mileage", header: "Kilometraje", format: "integer" },
        { key: "gallons", header: "Galones", format: "decimal" },
        { key: "cpg", header: "Costo/Galón (C$)", format: "currency", numFmt: "[$C$ ]#,##0.00" },
        { key: "total", header: "Costo Total (C$)", format: "currency", numFmt: "[$C$ ]#,##0.00" },
        { key: "efficiency", header: "Eficiencia (km/gal)", format: "decimal" },
        { key: "station", header: "Estación" },
      ],
    }, "registros_combustible", "Combustible");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExportCSV} disabled={!rows.length}>
        <FileDown className="mr-2 h-4 w-4" /> CSV
      </Button>
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
