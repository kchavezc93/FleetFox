export default function ForbiddenPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-destructive">Acceso denegado</h1>
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección. Contacta a un administrador.</p>
      </div>
    </div>
  );
}
