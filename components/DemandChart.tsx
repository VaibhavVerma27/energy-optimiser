// components/DemandChart.tsx
"use client";

import {
    ResponsiveContainer, ComposedChart, Line, Area,
    XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot,
} from "recharts";
import type { ForecastHour } from "../lib/api";

interface DemandChartProps {
    data: ForecastHour[];
    capacityMw: number; // fallback only — per-hour capacity_mw from data takes priority
    showLegend?: boolean;
}

const CAPACITY_COLOR  = "#f59e0b";   // amber-gold — reads as "ceiling", not danger
const DEMAND_COLOR    = "#00d4aa";   // teal
const BASELINE_COLOR  = "#4da6ff";   // blue
const ADJUSTED_COLOR  = "rgba(0,212,170,0.45)";
const CI_FILL         = "rgba(0,212,170,0.10)";

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload ?? {};
    const visible = payload.filter((p: any) =>
        !["ci_lower", "ci_band"].includes(p.name)
    );
    const isHoliday = d.is_holiday === 1;
    const weatherEnhanced = d.weather_enhanced_cap;

    return (
        <div style={{
            background: "#0d1821", border: "1px solid rgba(0,212,170,0.25)",
            borderRadius: 7, padding: "10px 14px", fontSize: 11, minWidth: 190,
        }}>
            <p style={{ color: "#00d4aa", marginBottom: 5, fontFamily: "monospace",
                fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {label}
                {isHoliday && <span title="Holiday/Festival">🎉</span>}
                {weatherEnhanced && (
                    <span title="Capacity computed from real weather data"
                          style={{ fontSize: 9, color: CAPACITY_COLOR, fontWeight: 400 }}>
            ⚡ weather-enhanced
          </span>
                )}
            </p>

            {/* CI band */}
            {d.ci_lower != null && d.ci_band != null && (
                <p style={{ color: "rgba(0,212,170,0.55)", margin: "0 0 5px", fontSize: 10 }}>
                    80% CI: {Math.round(d.ci_lower).toLocaleString()} –{" "}
                    {Math.round(d.ci_lower + d.ci_band).toLocaleString()} MW
                </p>
            )}

            {/* Main series */}
            {visible.map((p: any) => (
                <p key={p.name} style={{ color: p.color ?? p.stroke, margin: "2px 0" }}>
                    {p.name}:{" "}
                    <strong>
                        {typeof p.value === "number" ? `${p.value.toLocaleString()} MW` : "—"}
                    </strong>
                </p>
            ))}

            {/* Source breakdown when available */}
            {(d.solar_mw != null || d.wind_mw != null) && (
                <div style={{
                    marginTop: 6, paddingTop: 6,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", gap: 10, flexWrap: "wrap",
                }}>
                    {[
                        { label: "☀ Solar",   val: d.solar_mw,   color: "#ffd60a" },
                        { label: "💨 Wind",   val: d.wind_mw,    color: "#4da6ff" },
                        { label: "💧 Hydro",  val: d.hydro_mw,   color: "#00d4aa" },
                        { label: "🔥 Thermal",val: d.thermal_mw, color: "#ff6b35" },
                    ].filter(s => s.val != null).map(s => (
                        <span key={s.label} style={{ color: s.color, fontSize: 10 }}>
              {s.label} {s.val != null ? `${(s.val/1000).toFixed(1)}K` : "—"}
            </span>
                    ))}
                </div>
            )}

            {/* Weather */}
            {d.temp != null && (
                <p style={{ color: CAPACITY_COLOR, margin: "5px 0 0", fontSize: 10 }}>
                    🌡 {d.temp}°C · 💧 {d.humidity}%{" "}
                    {d.solar_cf != null && `· ☀ CF ${Math.round(d.solar_cf * 100)}%`}
                </p>
            )}
        </div>
    );
};

export function DemandChart({ data, capacityMw, showLegend = true }: DemandChartProps) {
    const hasCI = data.some(d => d.ci_lower_mw != null && d.ci_upper_mw != null);
    const hasWeatherEnhanced = data.some(d => (d as any).weather_enhanced_cap);

    const chartData = data.map((d: any) => ({
        label:      d.label,
        "Demand":   d.predicted_demand_mw,
        "Baseline": d.historical_baseline_mw,
        "Adjusted": d.adjusted_demand_mw,
        // Per-hour dynamic capacity — the critical line
        // Each hour has its own value from the capacity engine
        "Capacity": d.capacity_mw ?? capacityMw,
        // CI band
        ci_lower: hasCI ? (d.ci_lower_mw ?? d.predicted_demand_mw) : undefined,
        ci_band:  hasCI
            ? Math.max(0, (d.ci_upper_mw ?? d.predicted_demand_mw) - (d.ci_lower_mw ?? d.predicted_demand_mw))
            : undefined,
        // Source breakdown for tooltip
        solar_mw:   d.solar_available_mw,
        wind_mw:    d.wind_available_mw,
        hydro_mw:   d.hydro_available_mw,
        thermal_mw: d.thermal_available_mw,
        // Weather
        temp:     d.weather_temp_c,
        humidity: d.weather_humidity_pct,
        solar_cf: d.solar_cf,
        // Flags
        is_holiday:           (d.is_national_holiday || d.is_major_festival || d.is_diwali_window) ? 1 : 0,
        weather_enhanced_cap: d.weather_enhanced_cap,
    }));

    // Y-axis domain: tightly around the data range
    const allVals = chartData.flatMap(d => [d.Demand, d.Capacity]).filter(Boolean) as number[];
    const minVal  = allVals.length ? Math.min(...allVals) : 0;
    const maxVal  = allVals.length ? Math.max(...allVals) : 1;
    const pad     = (maxVal - minVal) * 0.08;
    const yMin    = Math.floor((minVal - pad) / 1000) * 1000;
    const yMax    = Math.ceil ((maxVal + pad) / 1000) * 1000;

    // Find overload hours for dot markers
    const overloadHours = chartData
        .filter(d => d.Demand > d.Capacity)
        .map(d => d.label);

    return (
        <div>
            {/* Legend */}
            {showLegend && (
                <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                    {[
                        { color: DEMAND_COLOR,  label: "Predicted demand",         dash: false },
                        { color: CAPACITY_COLOR,label: hasWeatherEnhanced ? "Available capacity (weather-enhanced)" : "Available capacity", dash: true  },
                        { color: BASELINE_COLOR,label: "Historical baseline",       dash: true  },
                        { color: ADJUSTED_COLOR,label: "Post-DR adjusted",          dash: true  },
                    ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5,
                            fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
                            <svg width={20} height={6}>
                                <line x1={0} y1={3} x2={20} y2={3}
                                      stroke={l.color} strokeWidth={2}
                                      strokeDasharray={l.dash ? "5 3" : undefined} />
                            </svg>
                            {l.label}
                            {l.color === CAPACITY_COLOR && hasWeatherEnhanced && (
                                <span style={{ fontSize: 8, color: CAPACITY_COLOR }}>⚡</span>
                            )}
                        </div>
                    ))}
                    {hasCI && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5,
                            fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
                            <div style={{ width: 16, height: 8, background: CI_FILL,
                                border: `1px solid ${DEMAND_COLOR}`, borderRadius: 2 }} />
                            80% CI band
                        </div>
                    )}
                </div>
            )}

            <ResponsiveContainer width="100%" height={220}>
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
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9, fontFamily: "monospace" }}
                        axisLine={false}
                        tickLine={false}
                        domain={[yMin, yMax]}
                        width={38}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* CI band — render before demand so it's behind */}
                    {hasCI && (
                        <Area type="monotone" dataKey="ci_lower"
                              stroke="none" fill="none" dot={false}
                              isAnimationActive={false} legendType="none" />
                    )}
                    {hasCI && (
                        <Area type="monotone" dataKey="ci_band" stackId="ci"
                              stroke="none" fill={CI_FILL} dot={false}
                              isAnimationActive={false} legendType="none" />
                    )}

                    {/* Baseline */}
                    <Line type="monotone" dataKey="Baseline"
                          stroke={BASELINE_COLOR} strokeWidth={1.5} strokeDasharray="3 4"
                          dot={false} isAnimationActive={false} />

                    {/* Adjusted demand */}
                    <Line type="monotone" dataKey="Adjusted"
                          stroke={ADJUSTED_COLOR} strokeWidth={1.5} strokeDasharray="5 3"
                          dot={false} isAnimationActive={false} />

                    {/* Predicted demand — main filled area */}
                    <Area type="monotone" dataKey="Demand"
                          stroke={DEMAND_COLOR} strokeWidth={2}
                          fill="rgba(0,212,170,0.07)"
                          dot={false} isAnimationActive={false} />

                    {/* Dynamic capacity — amber-gold dashed, varies every hour */}
                    <Line type="monotone" dataKey="Capacity"
                          stroke={CAPACITY_COLOR} strokeWidth={2.5}
                          strokeDasharray="6 3"
                          dot={false} isAnimationActive={false} />

                    {/* Mark overload hours with a red dot on the capacity line */}
                    {overloadHours.map(label => {
                        const d = chartData.find(x => x.label === label);
                        if (!d) return null;
                        return (
                            <ReferenceDot key={label} x={label} y={d.Capacity}
                                          r={4} fill="#ff4d6a" stroke="#0d1821" strokeWidth={1.5} />
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}