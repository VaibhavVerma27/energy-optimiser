// components/DemandChart.tsx
"use client";

import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    ReferenceLine,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
} from "recharts";
import type { ForecastHour } from "../lib/api";

interface DemandChartProps {
    data: ForecastHour[];
    capacityMw: number;
}

// @ts-expect-error abc
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "#0d1821", border: "1px solid rgba(0,212,170,0.3)",
            borderRadius: 6, padding: "10px 14px", fontSize: 12,
        }}>
            <p style={{ color: "#00d4aa", marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
                    {p.name}: <strong>{p.value?.toLocaleString()} MW</strong>
                </p>
            ))}
        </div>
    );
};

export function DemandChart({ data, capacityMw }: DemandChartProps) {
    const chartData = data.map((d) => ({
        label: d.label,
        "Predicted": d.predicted_demand_mw,
        "Historical": d.historical_baseline_mw,
        "Adjusted": d.adjusted_demand_mw,
    }));

    return (
        <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    interval={3}
                />
                <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`}
                    tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[4000, 11500]}
                    width={38}
                />
                <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />

                {/* Grid capacity line */}
                <ReferenceLine
                    y={capacityMw}
                    stroke="#ff4d6a"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: "Capacity", fill: "#ff4d6a", fontSize: 9, position: "insideTopRight" }}
                />

                {/* Historical baseline */}
                <Line
                    type="monotone"
                    dataKey="Historical"
                    stroke="#4da6ff"
                    strokeWidth={1.5}
                    strokeDasharray="3 4"
                    dot={false}
                />

                {/* Adjusted curve */}
                <Line
                    type="monotone"
                    dataKey="Adjusted"
                    stroke="rgba(0,212,170,0.5)"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                />

                {/* Predicted demand — main area */}
                <Area
                    type="monotone"
                    dataKey="Predicted"
                    stroke="#00d4aa"
                    strokeWidth={2}
                    fill="rgba(0,212,170,0.06)"
                    dot={false}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}