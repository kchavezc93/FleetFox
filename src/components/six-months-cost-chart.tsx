"use client";

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

export type SixMonthPoint = {
  label: string; // YYYY-MM
  maintenance: number;
  fueling: number;
};

type Props = {
  data: SixMonthPoint[];
  currency?: string;
  locale?: string;
};

export default function SixMonthsCostChart({ data, currency = "NIO", locale = "es-NI" }: Props) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [currency, locale]);

  const chartData = React.useMemo(() => {
    return data.map((p) => ({
      name: p.label,
      maintenance: Number(p.maintenance) || 0,
      fueling: Number(p.fueling) || 0,
    }));
  }, [data]);

  return (
    <ChartContainer
      config={{
        maintenance: { label: "Mantenimiento", color: "hsl(var(--chart-2))" },
        fueling: { label: "Combustible", color: "hsl(var(--chart-1))" },
      }}
      className="w-full h-72 lg:h-80"
    >
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
          <defs>
            <linearGradient id="grad-maint" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="grad-fuel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis width={84} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={(v) => nf.format(Number(v))} />
          <ChartTooltip
            content={<ChartTooltipContent />}
            formatter={(value: any, name: any) => {
              const label = name === "maintenance" ? "Mantenimiento" : name === "fueling" ? "Combustible" : String(name);
              return `${label}: ${nf.format(Number(value))}`;
            }}
          />
          <Legend content={<ChartLegendContent />} />
          <Area type="monotone" dataKey="maintenance" stroke="hsl(var(--chart-2))" strokeWidth={2.5} fillOpacity={1} fill="url(#grad-maint)" />
          <Area type="monotone" dataKey="fueling" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fillOpacity={1} fill="url(#grad-fuel)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
