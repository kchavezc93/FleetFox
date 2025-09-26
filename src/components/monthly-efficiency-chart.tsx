"use client";

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

export type MonthlyEfficiencyPoint = {
  label: string; // YYYY-MM
  avgEfficiency: number | null; // km/gal
};

type Props = {
  data: MonthlyEfficiencyPoint[];
  locale?: string;
};

export default function MonthlyEfficiencyChart({ data, locale = "es-NI" }: Props) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 }), [locale]);

  const chartData = React.useMemo(() => data.map(p => ({ name: p.label, value: p.avgEfficiency ?? 0 })), [data]);

  return (
    <ChartContainer
      config={{ value: { label: "Eficiencia (km/gal)", color: "hsl(var(--chart-4))" } }}
      className="w-full h-72 lg:h-80"
    >
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
          <defs>
            <linearGradient id="grad-eff" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis width={72} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={(v) => nf.format(Number(v))} />
          <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any) => `Eficiencia: ${nf.format(Number(value))} km/gal`} />
          <Legend content={<ChartLegendContent />} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-4))" strokeWidth={2.5} fillOpacity={1} fill="url(#grad-eff)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
