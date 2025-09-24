"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportToXLSX } from "@/lib/export-excel";

export type UserExportRow = {
  username: string;
  email: string;
  role: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function UsersExportButtons({ rows }: { rows: UserExportRow[] }) {
  const handleExportXLSX = async () => {
    if (!rows.length) return;
    await exportToXLSX({
      rows: rows.map(r => ({
        username: r.username,
        email: r.email,
        role: r.role,
        active: r.active ? "Activo" : "Inactivo",
        createdAt: r.createdAt ?? "",
        updatedAt: r.updatedAt ?? "",
      })),
      columns: [
        { key: "username", header: "Usuario", width: 18 },
        { key: "email", header: "Correo", width: 28 },
        { key: "role", header: "Rol" },
        { key: "active", header: "Estado" },
        { key: "createdAt", header: "Creado", format: "datetime" },
        { key: "updatedAt", header: "Actualizado", format: "datetime" },
      ],
    }, "usuarios", "Usuarios");
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
