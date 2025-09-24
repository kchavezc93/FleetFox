// src/components/layout/header.tsx
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Bell, UserCircle, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { logoutUser } from "@/lib/actions/auth-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="sm:hidden" />
      <div className="flex-1">
        {/* Optional: Breadcrumbs or Page Title can go here */}
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificaciones</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menú de usuario">
              <UserCircle className="h-6 w-6" />
              <span className="sr-only">Menú de usuario</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <form action={logoutUser}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full flex items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
