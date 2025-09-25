
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginSchema } from "@/lib/zod-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loginUser } from "@/lib/actions/auth-actions";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image"; 
import type ReactNamespace from "react";

function LoginFormInner() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyName = (process as any)?.env?.NEXT_PUBLIC_COMPANY_NAME || "Dos Robles";
  const companyLogoUrl = (process as any)?.env?.NEXT_PUBLIC_COMPANY_LOGO_URL;

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginSchema) {
    setIsSubmitting(true);
    try {
  const result = await loginUser(data);
      if (result.success) {
        toast({
          title: "Inicio de Sesión Exitoso",
          description: result.message,
        });
  const nextFromServer = (result as any).redirectUrl as string | undefined;
  const next = nextFromServer || searchParams.get('next') || '/dashboard';
  router.push(next);
      } else {
        toast({
          title: "Error de Inicio de Sesión",
          description: result.message || "Credenciales incorrectas o error del servidor.",
          variant: "destructive",
        });
        if (result.errors) {
             Object.entries(result.errors).forEach(([field, message]) => {
              form.setError(field as keyof LoginSchema, { type: "manual", message: message as string });
            });
        }
      }
    } catch (error) {
      toast({
        title: "Error Inesperado",
        description: "Ocurrió un error al intentar iniciar sesión.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
           {companyLogoUrl ? (
            <Image
              src={companyLogoUrl}
              alt={`Logo de ${companyName}`}
              width={48}
              height={48}
              className="object-contain"
              data-ai-hint="company logo"
            />
          ) : (
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-primary"
              aria-label="Logo genérico"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          )}
        </div>
        <CardTitle className="text-2xl font-bold text-primary">{companyName}</CardTitle>
        <CardDescription>Iniciar sesión para administrar la flota</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu@correo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Iniciar Sesión
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta? Contacta al administrador.
        </p>
         <p className="mt-2 text-center text-sm">
          <Link href="/" className="font-medium text-primary hover:underline">
            Volver a la página de inicio
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  // Wrap client router/searchParams usage in Suspense per Next.js guidance
  return (
    <Suspense fallback={<div className="w-full max-w-md text-center py-8">Cargando…</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
