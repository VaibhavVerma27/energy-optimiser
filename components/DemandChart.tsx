// components/DemandChart.tsx
"use client";

import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import type { ForecastHour } from "../lib/api";

interface DemandChartProps {
    data: ForecastHour[];
    capacityMw: number; // fallback only — chart uses per-hour capacity_mw from data
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "#0d1821", border: "1px solid rgba(0,212,170,0.3)",
            borderRadius: 6, padding: "10px 14px", fontSize: 11,
        }}>
            <p style={{ color: "#00d4aa", marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color ?? p.stroke, margin: "2px 0" }}>
                    {p.name}:{" "}
                    <strong>
                        {typeof p.value === "number" ? `${p.value.toLocaleString()} MW` : "—"}
                    </strong>
                </p>
            ))}
        </div>
    );
};

export function DemandChart({ data, capacityMw }: DemandChartProps) {
    // Build chart rows — use per-hour capacity_mw from forecast if present,
    // fall back to the single capacityMw prop only when missing.
    const chartData = data.map((d) => ({
        label:      d.label,
        Predicted:  d.predicted_demand_mw,
        Historical: d.historical_baseline_mw,
        Adjusted:   d.adjusted_demand_mw,
        // KEY FIX: per-hour dynamic capacity — varies with solar/wind/hydro/thermal
        "Avail. Capacity": d.capacity_mw ?? capacityMw,
    }));

    // Y-axis domain: span from a bit below min capacity to a bit above max demand
    const allVals = chartData.flatMap((d) => [
        d.Predicted,
        d["Avail. Capacity"],
    ]).filter(Boolean);
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const pad    = (maxVal - minVal) * 0.08;
    const yMin   = Math.floor((minVal - pad) / 1000) * 1000;
    const yMax   = Math.ceil ((maxVal + pad) / 1000) * 1000;

    return (
        <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    vertical={false}
                />
                <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    interval={3}
                />
                <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[yMin, yMax]}
                    width={38}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Predicted demand — main filled area */}
                <Area
                    type="monotone"
                    dataKey="Predicted"
                    stroke="#00d4aa"
                    strokeWidth={2}
                    fill="rgba(0,212,170,0.07)"
                    dot={false}
                    isAnimationActive={false}
                />

                {/* Historical baseline */}
                <Line
                    type="monotone"
                    dataKey="Historical"
                    stroke="#4da6ff"
                    strokeWidth={1.5}
                    strokeDasharray="3 4"
                    dot={false}
                    isAnimationActive={false}
                />

                {/* Adjusted demand after DR */}
                <Line
                    type="monotone"
                    dataKey="Adjusted"
                    stroke="rgba(0,212,170,0.45)"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                    isAnimationActive={false}
                />

                {/* Dynamic capacity — per-hour line (varies with solar/wind/hydro/thermal) */}
                <Line
                    type="monotone"
                    dataKey="Avail. Capacity"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    isAnimationActive={false}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}