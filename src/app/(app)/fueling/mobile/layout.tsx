import Link from "next/link";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Fuel } from "lucide-react";

export default function MobileFuelingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card p-3">
        <Link href="/fueling">
          <Button size="sm" variant="outline">Regresar</Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Fuel className="h-4 w-4" />
          <span>Registro de Combustible (Móvil)</span>
        </div>
      </header>
      <main className="p-3">
        {children}
      </main>
    </div>
  );
}
