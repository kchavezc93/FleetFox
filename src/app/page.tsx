
// src/app/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarFront, Fuel, Wrench, ArrowRight } from "lucide-react";
import Link from "next/link";
// Image component is no longer needed here if logo is removed from this page's header
// import Image from "next/image"; 

export default function LandingPage() {
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Dos Robles";
  // companyLogoUrl is no longer needed here if logo is removed
  // const companyLogoUrl = process.env.NEXT_PUBLIC_COMPANY_LOGO_URL;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-primary text-primary-foreground py-4 px-6 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            {/* Logo removed, only company name remains */}
            <span>{companyName}</span>
          </Link>
          <nav>
            <Link href="/dashboard">
              <Button variant="secondary">Ir al Panel</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-6 py-12">
        <section className="text-center mb-16">
          <h1 className="text-5xl font-bold text-primary mb-4">
            Gestión de Flota para {companyName}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Optimiza la gestión de la flota de vehículos de {companyName} con esta aplicación integral. Realiza un seguimiento eficiente del mantenimiento, controla el consumo de combustible y obtén información valiosa para la toma de decisiones estratégicas de la empresa.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Comenzar <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CarFront className="h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-primary">Gestión de Vehículos</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Mantenga registros detallados de todos sus vehículos, desde números de matrícula hasta el kilometraje y estado actual.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <Wrench className="h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-primary">Seguimiento de Mantenimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Registre el mantenimiento preventivo y correctivo, programe servicios futuros y controle los costos.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <Fuel className="h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-primary">Control de Combustible</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Registre las cargas de combustible, calcule la eficiencia y administre los gastos de combustible de manera efectiva.
              </CardDescription>
            </CardContent>
          </Card>
        </section>
        
        <section className="bg-card p-8 rounded-lg shadow-xl">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-primary mb-4">Informes Detallados y Eficientes</h2>
            <p className="text-lg text-muted-foreground mb-6">
             Con esta aplicación, {companyName} puede obtener análisis precisos sobre el consumo de combustible, costos de mantenimiento y rendimiento general de su flota. Tome decisiones basadas en datos para optimizar sus operaciones.
            </p>
            <div className="flex justify-center md:justify-start">
              <Link href="/reports">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  Explorar Informes
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-muted text-muted-foreground py-6 text-center">
        <p>&copy; {new Date().getFullYear()} {companyName}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

