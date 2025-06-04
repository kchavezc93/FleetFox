import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-6">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h2 className="text-2xl font-semibold text-primary mb-2">Cargando...</h2>
      <p className="text-muted-foreground">
        Por favor, espera un momento mientras preparamos la página.
      </p>
    </div>
  );
}
