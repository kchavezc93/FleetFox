
// src/components/layout/sidebar-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CarFront,
  Wrench,
  Fuel,
  BarChart3,
  Users,
  Bell,
  Settings,
  LucideIcon,
  ListChecks,
  History,      // Added
  CalendarClock, // Added
  TrendingUp,   // Added
  BarChartHorizontalBig, // Added for new report
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import React from "react";

interface NavItemConfig {
  key: string; 
  href: string;
  defaultLabel: string; 
  icon: LucideIcon;
  subItems?: NavItemConfig[];
  disabled?: boolean;
}

const navItemConfigs: NavItemConfig[] = [
  { key: "dashboard", href: "/dashboard", defaultLabel: "Panel de Control", icon: LayoutDashboard },
  { key: "vehicles", href: "/vehicles", defaultLabel: "Vehículos", icon: CarFront },
  { key: "maintenance", href: "/maintenance", defaultLabel: "Mantenimiento", icon: Wrench },
  { key: "fuelingLogs", href: "/fueling", defaultLabel: "Registros de Combustible", icon: Fuel },
  {
    key: "reports",
    href: "/reports",
    defaultLabel: "Informes",
    icon: BarChart3,
    subItems: [
      { key: "fuelConsumptionReport", href: "/reports/fuel-consumption", defaultLabel: "Consumo de Combustible", icon: Fuel },
      { key: "maintenanceCostsReport", href: "/reports/maintenance-costs", defaultLabel: "Costos de Mantenimiento", icon: Wrench },
      { key: "overallVehicleCostsReport", href: "/reports/overall-vehicle-costs", defaultLabel: "Costos Generales Vehículo", icon: ListChecks },
      { key: "maintenanceHistoryReport", href: "/reports/maintenance-history", defaultLabel: "Historial de Mantenimiento", icon: History },
      { key: "upcomingMaintenanceReport", href: "/reports/upcoming-maintenance", defaultLabel: "Mantenimiento Próximo", icon: CalendarClock },
      { key: "fuelEfficiencyAnalysisReport", href: "/reports/fuel-efficiency-analysis", defaultLabel: "Análisis de Eficiencia", icon: TrendingUp },
      { key: "comparativeExpenseAnalysisReport", href: "/reports/comparative-expense-analysis", defaultLabel: "Análisis Comparativo Gastos", icon: BarChartHorizontalBig },
    ],
  },
  { key: "alerts", href: "/alerts", defaultLabel: "Alertas", icon: Bell, disabled: false }, 
  { key: "userManagement", href: "/users", defaultLabel: "Gestión de Usuarios", icon: Users, disabled: false }, 
  { key: "settings", href: "/settings", defaultLabel: "Configuración", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>({});

  const toggleSubMenu = (labelKey: string) => {
    setOpenSubMenus(prev => ({ ...prev, [labelKey]: !prev[labelKey] }));
  };

  // Automatically open submenu if a child route is active
  React.useEffect(() => {
    const activeParent = navItemConfigs.find(item => 
      item.subItems?.some(sub => pathname.startsWith(sub.href))
    );
    if (activeParent && !openSubMenus[activeParent.key]) {
      setOpenSubMenus(prev => ({ ...prev, [activeParent.key]: true }));
    }
  }, [pathname, openSubMenus]);


  const renderNavItem = (itemConfig: NavItemConfig, isSubItem = false) => {
    const label = itemConfig.defaultLabel; 
    const isActive = pathname === itemConfig.href || (itemConfig.href !== "/" && pathname.startsWith(itemConfig.href) && itemConfig.href.length > 1 && (!itemConfig.subItems || itemConfig.subItems.length === 0));
    const hasSubItems = itemConfig.subItems && itemConfig.subItems.length > 0;
    
    let isSubMenuOpen = openSubMenus[itemConfig.key] || false;
    if (hasSubItems && itemConfig.subItems?.some(sub => pathname.startsWith(sub.href))) {
      isSubMenuOpen = true; // Keep open if a child is active
    }


    if (hasSubItems) {
      const isParentActive = itemConfig.subItems?.some(sub => pathname.startsWith(sub.href));
      return (
        <SidebarMenuItem key={itemConfig.key}>
          <SidebarMenuButton
            onClick={() => toggleSubMenu(itemConfig.key)}
            isActive={isParentActive && !isSubMenuOpen} 
            aria-expanded={isSubMenuOpen}
            className="justify-between"
            tooltip={label}
            disabled={itemConfig.disabled}
          >
            <div className="flex items-center gap-2">
              <itemConfig.icon className="h-5 w-5" />
              <span>{label}</span>
            </div>
          </SidebarMenuButton>
          {isSubMenuOpen && (
            <SidebarMenuSub>
              {itemConfig.subItems?.map((subItemConfig) => (
                <SidebarMenuSubItem key={subItemConfig.key}>
                   <Link href={subItemConfig.href} passHref legacyBehavior>
                    <SidebarMenuSubButton
                      isActive={pathname === subItemConfig.href || pathname.startsWith(subItemConfig.href)}
                      disabled={subItemConfig.disabled}
                    >
                      {subItemConfig.defaultLabel} 
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      );
    }

    const ButtonComponent = isSubItem ? SidebarMenuSubButton : SidebarMenuButton;

    return (
      <SidebarMenuItem key={itemConfig.key}>
        <Link href={itemConfig.href} passHref legacyBehavior>
          <ButtonComponent
            isActive={isActive}
            tooltip={label}
            disabled={itemConfig.disabled}
          >
            <itemConfig.icon className="h-5 w-5" />
            <span>{label}</span>
          </ButtonComponent>
        </Link>
      </SidebarMenuItem>
    );
  };


  return (
    <SidebarMenu>
      <SidebarGroup>
        <SidebarGroupLabel>Menú</SidebarGroupLabel> 
        {navItemConfigs.map((item) => renderNavItem(item))}
      </SidebarGroup>
    </SidebarMenu>
  );
}

