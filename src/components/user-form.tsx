// @ts-nocheck
"use client";

import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { userSchema } from "@/lib/zod-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

// Create-only schema: ensure password is required on create
const createUserSchema = userSchema.extend({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type CreateUserSchema = z.infer<typeof createUserSchema>;
type EditUserSchema = z.infer<typeof userSchema>; // password optional here

interface UserFormProps {
  mode: "create" | "edit";
  initial?: Partial<EditUserSchema>;
  onSubmitAction: (
    data: CreateUserSchema | EditUserSchema
  ) => Promise<{ success: boolean; message: string; errors?: Record<string, string>; userId?: string }>;
}

export function UserForm({ mode, initial, onSubmitAction }: UserFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<any>({
    resolver: zodResolver(mode === "create" ? createUserSchema : userSchema),
    defaultValues: {
      email: initial?.email ?? "",
      username: initial?.username ?? "",
      fullName: initial?.fullName ?? "",
      password: "",
      role: initial?.role ?? "Standard",
      permissions: initial?.permissions ?? [],
      active: initial?.active ?? true,
    },
  });

  async function onSubmit(values: any) {
    setIsSubmitting(true);
    try {
      const result = await onSubmitAction(values);
      if (result.success) {
        toast({ title: mode === "create" ? "Usuario creado" : "Usuario actualizado", description: result.message });
        router.push("/users");
        router.refresh();
      } else {
        toast({ title: mode === "create" ? "No se pudo crear" : "No se pudo actualizar", description: result.message, variant: "destructive" });
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, message]) => {
            // Narrow known fields; fallback to form-level with name 'email'
            const key = ["email", "username", "password", "fullName", "role"].includes(field)
              ? field
              : "email";
            form.setError(key as any, { type: "manual", message: String(message) });
          });
        }
      }
    } catch (e) {
      toast({ title: "Error", description: "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usuario *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: jdoe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="usuario@empresa.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre y Apellidos" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rol *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione rol" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {mode === "create" ? "Contraseña *" : "Contraseña (opcional)"}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={mode === "create" ? "Mínimo 6 caracteres" : "Dejar en blanco para no cambiar"}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permisos (básico)</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { key: "/dashboard", label: "Dashboard" },
                      { key: "/vehicles", label: "Vehículos" },
                      { key: "/maintenance", label: "Mantenimiento" },
                      { key: "/fueling", label: "Combustible" },
                      { key: "/fueling-mobile", label: "Combustible (Móvil)" },
                      { key: "/reports", label: "Reportes" },
                      { key: "/alerts", label: "Alertas" },
                      { key: "/users", label: "Usuarios" },
                      { key: "/settings", label: "Configuración" },
                    ].map(p => {
                      const checked = (field.value || []).includes(p.key);
                      return (
                        <label key={p.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              const next = new Set<string>(field.value || []);
                              if (c) next.add(p.key); else next.delete(p.key);
                              field.onChange(Array.from(next));
                            }}
                          />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Activo</FormLabel>
                <FormControl>
                  <div className="flex items-center space-x-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="text-sm text-muted-foreground">Puede iniciar sesión</span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mode === "create" ? "Crear Usuario" : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
