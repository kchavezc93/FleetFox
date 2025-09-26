"use client";

import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export default function AlertsUpdatedToast() {
  useEffect(() => {
    toast({ title: "Alertas actualizadas", description: "Se generaron y refrescaron las alertas." });
  }, []);
  return null;
}
