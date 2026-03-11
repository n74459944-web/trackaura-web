"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { PricePoint } from "@/types";

interface PriceChartProps {
  data: PricePoint[];
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as PricePoint;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "0.625rem 0.875rem",
        fontSize: "0.8125rem",
      }}
    >
      <p style={{ color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
        {new Date(point.date).toLocaleDateString("en-CA", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <p className="price-tag" style={{ fontSize: "1rem" }}>
        ${point.price.toFixed(2)}
      </p>
    </div>
  );
}

export default function PriceChart({ data, currentPrice, minPrice, maxPrice }: PriceChartProps) {
  if (!data.length) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
        }}
      >
        No price history available yet.
      </div>
    );
  }

  // Calculate Y axis domain with some padding
  const prices = data.map((d) => d.price);
  const yMin = Math.floor(Math.min(...prices) * 0.95);
  const yMax = Math.ceil(Math.max(...prices) * 1.05);

  const isSparse = data.length < 7;

  return (
    <div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="var(--text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => `$${v}`}
              stroke="var(--text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            {minPrice < maxPrice && (
              <ReferenceLine
                y={minPrice}
                stroke="var(--accent)"
                strokeDasharray="4 4"
                opacity={0.5}
                label={{
                  value: `Low: $${minPrice.toFixed(2)}`,
                  fill: "var(--accent)",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
            <Line
              type="stepAfter"
              dataKey="price"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--bg-primary)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {isSparse && (
        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.5rem", fontStyle: "italic" }}>
          {"Building price history \u2014 prices are checked every 4 hours. Set a price alert to get notified of drops."}
        </p>
      )}
    </div>
  );
}
