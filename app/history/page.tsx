"use client";

import { useState } from "react";
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, CartesianGrid, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, ComposedChart, Line,
} from "recharts";

// ── Mock historical data ──────────────────────────────────────────────────────

const HOURLY_PROFILE = [
    { hour: "00", weekday: 26800, weekend: 24100, label: "12am" },
    { hour: "01", weekday: 25400, weekend: 23200, label: "1am" },
    { hour: "02", weekday: 24600, weekend: 22800, label: "2am" },
    { hour: "03", weekday: 24200, weekend: 22400, label: "3am" },
    { hour: "04", weekday: 24600, weekend: 22700, label: "4am" },
    { hour: "05", weekday: 26100, weekend: 23400, label: "5am" },
    { hour: "06", weekday: 29400, weekend: 25100, label: "6am" },
    { hour: "07", weekday: 33800, weekend: 27600, label: "7am" },
    { hour: "08", weekday: 37200, weekend: 30100, label: "8am" },
    { hour: "09", weekday: 39800, weekend: 32400, label: "9am" },
    { hour: "10", weekday: 41600, weekend: 34200, label: "10am" },
    { hour: "11", weekday: 42900, weekend: 35800, label: "11am" },
    { hour: "12", weekday: 43800, weekend: 36900, label: "12pm" },
    { hour: "13", weekday: 44200, weekend: 37400, label: "1pm" },
    { hour: "14", weekday: 44800, weekend: 38100, label: "2pm" },
    { hour: "15", weekday: 44600, weekend: 38400, label: "3pm" },
    { hour: "16", weekday: 44900, weekend: 38800, label: "4pm" },
    { hour: "17", weekday: 45800, weekend: 39200, label: "5pm" },
    { hour: "18", weekday: 46200, weekend: 39800, label: "6pm" },
    { hour: "19", weekday: 45400, weekend: 39400, label: "7pm" },
    { hour: "20", weekday: 43200, weekend: 37900, label: "8pm" },
    { hour: "21", weekday: 40400, weekend: 35600, label: "9pm" },
    { hour: "22", weekday: 36800, weekend: 32100, label: "10pm" },
    { hour: "23", weekday: 31200, weekend: 27800, label: "11pm" },
];

const MONTHLY_DEMAND = [
    { month: "Jan", avg: 38200, peak: 52400, min: 23100 },
    { month: "Feb", avg: 36800, peak: 49800, min: 22400 },
    { month: "Mar", avg: 33200, peak: 44600, min: 21800 },
    { month: "Apr", avg: 30100, peak: 40200, min: 20400 },
    { month: "May", avg: 31400, peak: 43100, min: 21200 },
    { month: "Jun", avg: 36800, peak: 52800, min: 24100 },
    { month: "Jul", avg: 41200, peak: 58400, min: 26800 },
    { month: "Aug", avg: 39800, peak: 56200, min: 25900 },
    { month: "Sep", avg: 35400, peak: 48900, min: 23200 },
    { month: "Oct", avg: 30800, peak: 41600, min: 20900 },
    { month: "Nov", avg: 33400, peak: 45200, min: 21600 },
    { month: "Dec", avg: 37600, peak: 51800, min: 22800 },
];

const DOW_DEMAND = [
    { day: "Mon", avg: 39200, color: "#4da6ff" },
    { day: "Tue", avg: 40100, color: "#4da6ff" },
    { day: "Wed", avg: 40400, color: "#4da6ff" },
    { day: "Thu", avg: 40200, color: "#4da6ff" },
    { day: "Fri", avg: 38900, color: "#4da6ff" },
    { day: "Sat", avg: 34200, color: "#00d4aa" },
    { day: "Sun", avg: 32100, color: "#00d4aa" },
];

const YEARLY_TREND = Array.from({ length: 7 }, (_, i) => ({
    year: 2012 + i,
    avg: Math.round(34000 + i * 800 + Math.sin(i) * 1200),
    peak: Math.round(52000 + i * 1200 + Math.sin(i) * 2000),
}));

const OVERLOAD_EVENTS = [
    { date: "2016-07-22", hour: "15:00", actual: 52841, capacity: 50000, excess: 2841, action: "Backup + Industrial cut" },
    { date: "2016-07-23", hour: "16:00", actual: 51204, capacity: 50000, excess: 1204, action: "EV delay" },
    { date: "2017-01-07", hour: "08:00", actual: 50812, capacity: 50000, excess: 812,  action: "Industrial cut" },
    { date: "2017-07-18", hour: "14:00", actual: 53401, capacity: 50000, excess: 3401, action: "Full response" },
    { date: "2017-08-03", hour: "15:00", actual: 51982, capacity: 50000, excess: 1982, action: "Backup gen" },
    { date: "2018-01-05", hour: "09:00", actual: 50491, capacity: 50000, excess: 491,  action: "EV delay" },
];

const SEASON_RADAR = [
    { subject: "Morning Peak", Summer: 82, Winter: 71, Spring: 58, Autumn: 62 },
    { subject: "Afternoon Peak", Summer: 96, Winter: 74, Spring: 61, Autumn: 67 },
    { subject: "Evening Peak", Summer: 88, Winter: 89, Spring: 69, Autumn: 72 },
    { subject: "Night Base", Summer: 54, Winter: 61, Spring: 48, Autumn: 50 },
    { subject: "Weekend Drop", Summer: 78, Winter: 65, Spring: 52, Autumn: 55 },
    { subject: "Volatility", Summer: 72, Winter: 68, Spring: 45, Autumn: 49 },
];

// ── Components ────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#0d1821", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 6, padding: "10px 14px", fontSize: 11 }}>
            <p style={{ color: "#00d4aa", marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color ?? p.fill ?? "#e8f4f1", margin: "2px 0" }}>
                    {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value} MW</strong>
                </p>
            ))}
        </div>
    );
};

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
    return (
        <a href={href} style={{
            fontFamily: "monospace", fontSize: 10, letterSpacing: "0.08em",
            textDecoration: "none", padding: "4px 12px", borderRadius: 5,
            background: active ? "rgba(0,212,170,0.12)" : "transparent",
            color: active ? "#00d4aa" : "rgba(232,244,241,0.4)",
            border: active ? "1px solid rgba(0,212,170,0.25)" : "1px solid transparent",
        }}>{label}</a>
    );
}

function SummaryCard({ label, value, unit, color, sub }: { label: string; value: string | number; unit?: string; color: string; sub?: string }) {
    return (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${color}` }}>
            <div style={{ fontSize: 10, color: "rgba(232,244,241,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, color }}>
                {typeof value === "number" ? value.toLocaleString() : value}
                {unit && <span style={{ fontSize: 11, marginLeft: 3, opacity: 0.7 }}>{unit}</span>}
            </div>
            {sub && <div style={{ fontSize: 10, color: "rgba(232,244,241,0.4)", marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

    const S: Record<string, React.CSSProperties> = {
        root: { minHeight: "100vh", background: "#0a0f14", color: "#e8f4f1", fontFamily: "'Exo 2','Segoe UI',sans-serif", padding: "20px 24px" },
        header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" },
        title: { fontFamily: "monospace", fontSize: 13, letterSpacing: "0.15em", color: "#00d4aa", textTransform: "uppercase" },
        panel: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: 16 },
        panelTitle: { fontSize: 10, letterSpacing: "0.12em", color: "rgba(232,244,241,0.45)", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 },
        statsRow: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 14 },
        twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
        threeCol: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 },
        dot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
        tableRow: { display: "grid", gridTemplateColumns: "110px 70px 100px 100px 80px 1fr", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11, alignItems: "center" },
    };

    return (
        <div style={S.root}>

            {/* Header */}
            <div style={S.header}>
                <div>
                    <div style={S.title}>📊 Historical Demand Analysis</div>
                    <div style={{ fontSize: 11, color: "rgba(232,244,241,0.4)", marginTop: 3, fontFamily: "monospace" }}>
                        PJM East Grid · 2012–2018 · 52,608 hourly records
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <NavLink href="/" label="Dashboard" />
                    <NavLink href="/simulation" label="Simulator" />
                    <NavLink href="/insights" label="ML Insights" />
                    <NavLink href="/history" label="History" active />
                </div>
            </div>

            {/* Summary KPIs */}
            <div style={S.statsRow}>
                <SummaryCard label="Peak Ever Recorded" value="58,400"  unit="MW" color="#ff4d6a" sub="Jul 2017, 15:00" />
                <SummaryCard label="Average Demand"     value="36,100"  unit="MW" color="#00d4aa" sub="All years, all hours" />
                <SummaryCard label="Lowest Recorded"    value="20,400"  unit="MW" color="#4da6ff" sub="Apr 2014, 04:00" />
                <SummaryCard label="Overload Events"    value={6}        unit=""   color="#ffb347" sub="2012–2018 dataset" />
                <SummaryCard label="Peak Month"         value="July"     unit=""   color="#ff4d6a" sub="Avg 41,200 MW" />
            </div>

            {/* Hourly profile + DOW */}
            <div style={S.twoCol}>
                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#00d4aa" }} /> Average Demand by Hour — Weekday vs Weekend
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                        {[{ color: "#4da6ff", label: "Weekday" }, { color: "#00d4aa", label: "Weekend" }].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
                            </div>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={HOURLY_PROFILE} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={3} />
                            <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={32} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="weekday" name="Weekday" stroke="#4da6ff" fill="rgba(77,166,255,0.12)" strokeWidth={2} dot={false} />
                            <Area type="monotone" dataKey="weekend" name="Weekend" stroke="#00d4aa" fill="rgba(0,212,170,0.08)" strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(0,212,170,0.04)", borderRadius: 6, border: "1px solid rgba(0,212,170,0.12)", fontSize: 11, color: "rgba(232,244,241,0.55)", lineHeight: 1.6 }}>
                        <strong style={{ color: "#00d4aa" }}>Insight:</strong> Weekday demand peaks at 18:00 (evening cooking + commute). Weekend demand is ~15% lower on average and peaks later. Both show a clear morning ramp-up from 05:00.
                    </div>
                </div>

                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#4da6ff" }} /> Average Demand by Day of Week
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={DOW_DEMAND} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="day" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={32} domain={[28000, 44000]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="avg" name="Avg demand" radius={[4, 4, 0, 0]}>
                                {DOW_DEMAND.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={i < 5 ? 0.8 : 0.6} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(77,166,255,0.04)", borderRadius: 6, border: "1px solid rgba(77,166,255,0.12)", fontSize: 11, color: "rgba(232,244,241,0.55)", lineHeight: 1.6 }}>
                        <strong style={{ color: "#4da6ff" }}>Insight:</strong> Wednesday and Thursday are the highest demand days — full industrial and office activity. Sunday is the lowest. This 20% gap is why the weekend flag is a key model feature.
                    </div>
                </div>
            </div>

            {/* Monthly + Yearly */}
            <div style={S.twoCol}>
                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#ffb347" }} /> Monthly Demand Profile — Avg, Peak, Min
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                        {[{ color: "#ffb347", label: "Avg" }, { color: "#ff4d6a", label: "Peak" }, { color: "#4da6ff", label: "Min" }].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
                            </div>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={MONTHLY_DEMAND} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={32} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="peak" name="Peak" stroke="#ff4d6a" fill="rgba(255,77,106,0.08)" strokeWidth={1.5} dot={false} />
                            <Area type="monotone" dataKey="avg"  name="Avg"  stroke="#ffb347" fill="rgba(255,179,71,0.12)"  strokeWidth={2}   dot={false} />
                            <Line  type="monotone" dataKey="min"  name="Min"  stroke="#4da6ff" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(255,179,71,0.04)", borderRadius: 6, border: "1px solid rgba(255,179,71,0.12)", fontSize: 11, color: "rgba(232,244,241,0.55)", lineHeight: 1.6 }}>
                        <strong style={{ color: "#ffb347" }}>Insight:</strong> Two demand peaks — July/August (AC cooling) and January (electric heating). This U-shaped annual curve means the month feature and its cyclic encoding are critical for the model.
                    </div>
                </div>

                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#ff4d6a" }} /> Seasonal Load Profile — Radar View
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={SEASON_RADAR} margin={{ top: 4, right: 20, left: 20, bottom: 4 }}>
                            <PolarGrid stroke="rgba(255,255,255,0.08)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9 }} />
                            <Radar name="Summer" dataKey="Summer" stroke="#ff4d6a" fill="#ff4d6a" fillOpacity={0.15} />
                            <Radar name="Winter" dataKey="Winter" stroke="#4da6ff" fill="#4da6ff" fillOpacity={0.15} />
                            <Radar name="Spring" dataKey="Spring" stroke="#00d4aa" fill="#00d4aa" fillOpacity={0.1} />
                            <Radar name="Autumn" dataKey="Autumn" stroke="#ffb347" fill="#ffb347" fillOpacity={0.1} />
                            <Tooltip contentStyle={{ background: "#0d1821", border: "1px solid rgba(0,212,170,0.2)", fontSize: 11 }} />
                        </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {[{ color: "#ff4d6a", label: "Summer" }, { color: "#4da6ff", label: "Winter" }, { color: "#00d4aa", label: "Spring" }, { color: "#ffb347", label: "Autumn" }].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Yearly trend */}
            <div style={{ ...S.panel, marginBottom: 14 }}>
                <div style={S.panelTitle}>
                    <span style={{ ...S.dot, background: "#00d4aa" }} /> Year-over-Year Demand Trend (2012–2018)
                </div>
                <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={YEARLY_TREND} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={32} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="peak" name="Annual peak" stroke="#ff4d6a" fill="rgba(255,77,106,0.07)" strokeWidth={1.5} dot={{ fill: "#ff4d6a", r: 4 }} />
                        <Line  type="monotone" dataKey="avg"  name="Annual avg"  stroke="#00d4aa" strokeWidth={2} dot={{ fill: "#00d4aa", r: 4 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Overload events table */}
            <div style={S.panel}>
                <div style={S.panelTitle}>
                    <span style={{ ...S.dot, background: "#ff4d6a" }} /> Historical Overload Events Log
                </div>
                <div style={{ ...S.tableRow, background: "rgba(255,255,255,0.03)", borderRadius: "6px 6px 0 0", fontSize: 10, color: "rgba(232,244,241,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <span>Date</span><span>Hour</span><span>Actual MW</span><span>Capacity</span><span>Excess</span><span>Action Taken</span>
                </div>
                {OVERLOAD_EVENTS.map((e, i) => (
                    <div key={i} style={{ ...S.tableRow, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                        <span style={{ fontFamily: "monospace", color: "#e8f4f1" }}>{e.date}</span>
                        <span style={{ fontFamily: "monospace", color: "#ffb347" }}>{e.hour}</span>
                        <span style={{ fontFamily: "monospace", color: "#ff4d6a" }}>{e.actual.toLocaleString()}</span>
                        <span style={{ fontFamily: "monospace", color: "rgba(232,244,241,0.5)" }}>{e.capacity.toLocaleString()}</span>
                        <span style={{ fontFamily: "monospace", color: "#ff4d6a" }}>+{e.excess.toLocaleString()}</span>
                        <span style={{ background: "rgba(0,212,170,0.1)", color: "#00d4aa", padding: "2px 8px", borderRadius: 4, fontSize: 10, width: "fit-content", border: "1px solid rgba(0,212,170,0.2)" }}>{e.action}</span>
                    </div>
                ))}
                <div style={{ marginTop: 12, fontSize: 11, color: "rgba(232,244,241,0.35)", fontFamily: "monospace" }}>
                    6 overload events recorded across 52,608 hourly observations — 0.011% of all hours
                </div>
            </div>
        </div>
    );
}