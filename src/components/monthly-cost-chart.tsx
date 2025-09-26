"use client";

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Props = {
  maintenance: number;
  fueling: number;
  currency?: string; // ISO code, e.g., NIO, MXN; default NIO
  locale?: string; // e.g., es-NI
};

export default function MonthlyCostChart({ maintenance, fueling, currency = "NIO", locale = "es-NI" }: Props) {
  const data = React.useMemo(
    () => [
      { name: "Mes actual", maintenance: Number(maintenance) || 0, fueling: Number(fueling) || 0 },
    ],
    [maintenance, fueling]
  );

  const nf = React.useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [currency, locale]);

  return (
    <ChartContainer
      // Provide colors for the two categories (used by CSS variables if needed)
      config={{
        maintenance: { label: "Mantenimiento", color: "hsl(var(--chart-2))" },
        fueling: { label: "Combustible", color: "hsl(var(--chart-1))" },
      }}
      className="w-full h-64"
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis width={84} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={(v) => nf.format(Number(v))} />
          <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any, name: any) => {
            const label = name === "maintenance" ? "Mantenimiento" : name === "fueling" ? "Combustible" : String(name);
            return `${label}: ${nf.format(Number(value))}`;
          }} />
          <Legend content={<ChartLegendContent />} />
          <Bar dataKey="maintenance" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
          <Bar dataKey="fueling" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
