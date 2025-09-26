"use client";

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

type Props = {
  maintenance: number;
  fueling: number;
  currency?: string; // ISO code, e.g., NIO, MXN; default NIO
  locale?: string; // e.g., es-NI
};

export default function MonthlyCostChart({ maintenance, fueling, currency = "NIO", locale = "es-NI" }: Props) {
  const data = React.useMemo(
    () => [
      { name: "Mantenimiento", value: Number(maintenance) || 0, key: "maintenance", fill: "var(--color-maintenance)" },
      { name: "Combustible", value: Number(fueling) || 0, key: "fueling", fill: "var(--color-fueling)" },
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
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => nf.format(Number(v)).replace(/^C\$/, "C$")} />
          <ChartTooltip content={<ChartTooltipContent />} formatter={(value: any) => nf.format(Number(value))} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
