// "use client";
//
// import { useEffect, useState } from "react";
// import { fetchMockForecast, type GridForecastData } from "../../lib/api";
// import {
//     ResponsiveContainer, ComposedChart, Area, Line,
//     ReferenceLine, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
// } from "recharts";
//
// // ── Constants ─────────────────────────────────────────────────────────────────
// const COST_PER_MWH_BACKUP   = 180;   // $/MWh for peaker plant
// const COST_PER_MWH_INDUSTRY = 45;    // $/MWh savings from curtailment
// const COST_PER_MWH_EV       = 12;    // $/MWh cost of EV delay incentive
// const CO2_KG_PER_MWH_BACKUP = 490;   // kg CO₂/MWh for gas peaker
// const CO2_KG_PER_MWH_SAVED  = 420;   // kg CO₂/MWh avoided from demand reduction
//
// // ── Types ─────────────────────────────────────────────────────────────────────
// interface SimParams {
//     evDelayHours: number;
//     evShiftPct: number;
//     industrialCutPct: number;
//     residentialFlexPct: number;
//     backupSupplyMw: number;
//     capacityMw: number;
// }
//
// interface SimHour {
//     label: string;
//     original: number;
//     ev_shifted: number;
//     industrial_cut: number;
//     residential_flex: number;
//     backup_added: number;
//     final: number;
//     overCapacity: boolean;
//     saving: number;
// }
//
// interface CostCarbon {
//     backupCost: number;
//     industrySavings: number;
//     evIncentiveCost: number;
//     netCost: number;
//     co2FromBackup: number;
//     co2Avoided: number;
//     netCo2: number;
// }
//
// // ── Simulation Engine ─────────────────────────────────────────────────────────
// function runSimulation(
//     forecast: { label: string; predicted_demand_mw: number }[],
//     params: SimParams
// ): SimHour[] {
//     const n = forecast.length;
//     const demand = forecast.map(f => f.predicted_demand_mw);
//     const result: SimHour[] = [];
//     const evAdjusted = [...demand];
//     const evShifted = new Array(n).fill(0);
//     for (let i = 0; i < n; i++) {
//         const evLoad = demand[i] * 0.20 * (params.evShiftPct / 100);
//         evAdjusted[i] -= evLoad;
//         const target = Math.min(i + params.evDelayHours, n - 1);
//         evAdjusted[target] += evLoad;
//         evShifted[i] = evLoad;
//     }
//     const indAdjusted = [...evAdjusted];
//     const indCut = new Array(n).fill(0);
//     for (let i = 0; i < n; i++) {
//         const cut = demand[i] * 0.40 * (params.industrialCutPct / 100);
//         indAdjusted[i] -= cut;
//         indCut[i] = cut;
//     }
//     const resAdjusted = [...indAdjusted];
//     const resCut = new Array(n).fill(0);
//     for (let i = 0; i < n; i++) {
//         const cut = demand[i] * 0.40 * (params.residentialFlexPct / 100);
//         resAdjusted[i] -= cut;
//         resCut[i] = cut;
//     }
//     const final = [...resAdjusted];
//     const backupAdded = new Array(n).fill(0);
//     for (let i = 0; i < n; i++) {
//         if (final[i] > params.capacityMw) {
//             const add = Math.min(final[i] - params.capacityMw, params.backupSupplyMw);
//             final[i] -= add;
//             backupAdded[i] = add;
//         }
//     }
//     for (let i = 0; i < n; i++) {
//         result.push({
//             label: forecast[i].label,
//             original: Math.round(demand[i]),
//             ev_shifted: Math.round(evShifted[i]),
//             industrial_cut: Math.round(indCut[i]),
//             residential_flex: Math.round(resCut[i]),
//             backup_added: Math.round(backupAdded[i]),
//             final: Math.round(final[i]),
//             overCapacity: final[i] > params.capacityMw,
//             saving: Math.round(demand[i] - final[i]),
//         });
//     }
//     return result;
// }
//
// function calcCostCarbon(hours: SimHour[]): CostCarbon {
//     const totalBackupMwh    = hours.reduce((s, h) => s + h.backup_added, 0) / 1000;
//     const totalIndCutMwh    = hours.reduce((s, h) => s + h.industrial_cut, 0) / 1000;
//     const totalEvMwh        = hours.reduce((s, h) => s + h.ev_shifted, 0) / 1000;
//     const totalSavedMwh     = hours.reduce((s, h) => s + h.saving, 0) / 1000;
//     const backupCost        = Math.round(totalBackupMwh * COST_PER_MWH_BACKUP);
//     const industrySavings   = Math.round(totalIndCutMwh * COST_PER_MWH_INDUSTRY);
//     const evIncentiveCost   = Math.round(totalEvMwh * COST_PER_MWH_EV);
//     const netCost           = backupCost + evIncentiveCost - industrySavings;
//     const co2FromBackup     = Math.round(totalBackupMwh * CO2_KG_PER_MWH_BACKUP);
//     const co2Avoided        = Math.round(totalSavedMwh * CO2_KG_PER_MWH_SAVED);
//     const netCo2            = co2FromBackup - co2Avoided;
//     return { backupCost, industrySavings, evIncentiveCost, netCost, co2FromBackup, co2Avoided, netCo2 };
// }
//
// // ── Tooltip ───────────────────────────────────────────────────────────────────
// const CustomTooltip = ({ active, payload, label }: any) => {
//     if (!active || !payload?.length) return null;
//     return (
//         <div style={{ background: "#0d1821", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 6, padding: "10px 14px", fontSize: 11 }}>
//             <p style={{ color: "#00d4aa", marginBottom: 6, fontFamily: "monospace", fontWeight: 500 }}>{label}</p>
//             {payload.map((p: any) => (
//                 <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
//                     {p.name}: <strong>{p.value?.toLocaleString()} MW</strong>
//                 </p>
//             ))}
//         </div>
//     );
// };
//
// // ── Slider ────────────────────────────────────────────────────────────────────
// function Slider({ label, value, min, max, step = 1, unit = "%", color = "#00d4aa", onChange, description }: {
//     label: string; value: number; min: number; max: number;
//     step?: number; unit?: string; color?: string;
//     onChange: (v: number) => void; description: string;
// }) {
//     return (
//         <div style={{ marginBottom: 18 }}>
//             <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
//                 <span style={{ fontSize: 12, color: "#e8f4f1", fontWeight: 500 }}>{label}</span>
//                 <span style={{ fontFamily: "monospace", fontSize: 12, color }}>{value}{unit}</span>
//             </div>
//             <input type="range" min={min} max={max} step={step} value={value}
//                    onChange={e => onChange(Number(e.target.value))}
//                    style={{ width: "100%", accentColor: color }} />
//             <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
//                 <span style={{ fontSize: 10, color: "rgba(232,244,241,0.35)" }}>{min}{unit}</span>
//                 <span style={{ fontSize: 10, color: "rgba(232,244,241,0.35)" }}>{description}</span>
//                 <span style={{ fontSize: 10, color: "rgba(232,244,241,0.35)" }}>{max}{unit}</span>
//             </div>
//         </div>
//     );
// }
//
// // ── Stat Card ─────────────────────────────────────────────────────────────────
// function StatCard({ label, value, unit, color, sub }: {
//     label: string; value: string | number; unit?: string; color: string; sub?: string;
// }) {
//     return (
//         <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${color}` }}>
//             <div style={{ fontSize: 10, color: "rgba(232,244,241,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
//             <div style={{ fontFamily: "monospace", fontSize: 20, color }}>
//                 {typeof value === "number" ? value.toLocaleString() : value}
//                 {unit && <span style={{ fontSize: 11, marginLeft: 3, opacity: 0.7 }}>{unit}</span>}
//             </div>
//             {sub && <div style={{ fontSize: 10, color: "rgba(232,244,241,0.4)", marginTop: 3 }}>{sub}</div>}
//         </div>
//     );
// }
//
// // ── Cost Card ─────────────────────────────────────────────────────────────────
// function CostRow({ label, value, color, positive }: { label: string; value: number; color: string; positive?: boolean }) {
//     return (
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
//             <span style={{ fontSize: 12, color: "rgba(232,244,241,0.6)" }}>{label}</span>
//             <span style={{ fontFamily: "monospace", fontSize: 13, color }}>
//                 {positive ? "+" : value < 0 ? "" : "-"}${Math.abs(value).toLocaleString()}
//             </span>
//         </div>
//     );
// }
//
// // ── Nav Link ──────────────────────────────────────────────────────────────────
// function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
//     return (
//         <a href={href} style={{
//             fontFamily: "monospace", fontSize: 10, letterSpacing: "0.08em",
//             textDecoration: "none", padding: "4px 12px", borderRadius: 5,
//             background: active ? "rgba(0,212,170,0.12)" : "transparent",
//             color: active ? "#00d4aa" : "rgba(232,244,241,0.4)",
//             border: active ? "1px solid rgba(0,212,170,0.25)" : "1px solid transparent",
//         }}>{label}</a>
//     );
// }
//
// // ── Main Page ─────────────────────────────────────────────────────────────────
// export default function SimulationPage() {
//     const [forecastData, setForecastData] = useState<GridForecastData | null>(null);
//     const [loading, setLoading] = useState(true);
//     const [params, setParams] = useState<SimParams>({
//         evDelayHours: 2, evShiftPct: 100, industrialCutPct: 15,
//         residentialFlexPct: 5, backupSupplyMw: 500, capacityMw: 10000,
//     });
//
//     useEffect(() => {
//         fetchMockForecast().then(setForecastData).finally(() => setLoading(false));
//     }, []);
//
//     const set = (key: keyof SimParams) => (v: number) => setParams(p => ({ ...p, [key]: v }));
//
//     const dotStyle = (c: string): React.CSSProperties => ({ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" });
//     const badgeStyle = (ok: boolean): React.CSSProperties => ({
//         fontFamily: "monospace", fontSize: 10, padding: "3px 10px", borderRadius: 20,
//         textTransform: "uppercase", letterSpacing: "0.08em",
//         background: ok ? "rgba(0,212,170,0.12)" : "rgba(255,77,106,0.12)",
//         color: ok ? "#00d4aa" : "#ff4d6a",
//         border: `1px solid ${ok ? "rgba(0,212,170,0.3)" : "rgba(255,77,106,0.3)"}`,
//     });
//
//     const S: Record<string, React.CSSProperties> = {
//         root: { minHeight: "100vh", background: "#0a0f14", color: "#e8f4f1", fontFamily: "'Exo 2','Segoe UI',sans-serif", padding: "20px 24px" },
//         header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" },
//         title: { fontFamily: "monospace", fontSize: 13, letterSpacing: "0.15em", color: "#00d4aa", textTransform: "uppercase" },
//         grid: { display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 },
//         panel: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: 16 },
//         panelTitle: { fontSize: 10, letterSpacing: "0.12em", color: "rgba(232,244,241,0.45)", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 },
//         statsRow: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 14 },
//         divider: { height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 0" },
//         costGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
//         co2Bar: { height: 8, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden", margin: "8px 0" },
//     };
//
//     const simHours: SimHour[] = forecastData ? runSimulation(forecastData.forecast, params) : [];
//     const cc = calcCostCarbon(simHours);
//
//     const peakOriginal  = Math.max(...simHours.map(h => h.original), 0);
//     const peakFinal     = Math.max(...simHours.map(h => h.final), 0);
//     const totalSaving   = simHours.reduce((s, h) => s + h.saving, 0);
//     const overloadHours = simHours.filter(h => h.overCapacity).length;
//     const totalEvShifted = simHours.reduce((s, h) => s + h.ev_shifted, 0);
//     const totalIndCut   = simHours.reduce((s, h) => s + h.industrial_cut, 0);
//     const totalResFlex  = simHours.reduce((s, h) => s + h.residential_flex, 0);
//     const totalBackup   = simHours.reduce((s, h) => s + h.backup_added, 0);
//
//     const chartData = simHours.map(h => ({
//         label: h.label,
//         "Original Demand": h.original,
//         "Adjusted Demand": h.final,
//         "EV Shifted": h.ev_shifted,
//         "Industrial Cut": h.industrial_cut,
//         "Residential Flex": h.residential_flex,
//         "Backup Supply": h.backup_added,
//     }));
//
//     const costBreakdown = [
//         { name: "Backup Gen", value: cc.backupCost, fill: "#ff4d6a" },
//         { name: "EV Incentive", value: cc.evIncentiveCost, fill: "#ffb347" },
//         { name: "Ind. Savings", value: -cc.industrySavings, fill: "#00d4aa" },
//     ];
//
//     if (loading) return (
//         <div style={{ minHeight: "100vh", background: "#0a0f14", display: "flex", alignItems: "center", justifyContent: "center" }}>
//             <div style={{ fontFamily: "monospace", color: "#00d4aa", fontSize: 13, letterSpacing: "0.1em" }}>LOADING FORECAST DATA...</div>
//         </div>
//     );
//
//     return (
//         <div style={S.root}>
//
//             {/* Header */}
//             <div style={S.header}>
//                 <div>
//                     <div style={S.title}>⚡ Demand Response Simulator</div>
//                     <div style={{ fontSize: 11, color: "rgba(232,244,241,0.4)", marginTop: 3, fontFamily: "monospace" }}>
//                         Adjust sliders · see real-time impact on demand, cost & carbon
//                     </div>
//                 </div>
//                 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                     <NavLink href="/" label="Dashboard" />
//                     <NavLink href="/simulation" label="Simulator" active />
//                     <NavLink href="/insights" label="ML Insights" />
//                     <NavLink href="/history" label="History" />
//                     <span style={{ marginLeft: 8, ...badgeStyle(overloadHours === 0) }}>
//                         {overloadHours === 0 ? "✓ Grid Stable" : `⚠ ${overloadHours}h Overloaded`}
//                     </span>
//                 </div>
//             </div>
//
//             {/* Summary stats */}
//             <div style={S.statsRow}>
//                 <StatCard label="Peak Original"   value={peakOriginal.toLocaleString()}  unit="MW"   color="#ff4d6a" sub="Before interventions" />
//                 <StatCard label="Peak Adjusted"   value={peakFinal.toLocaleString()}     unit="MW"   color={peakFinal <= params.capacityMw ? "#00d4aa" : "#ffb347"} sub="After interventions" />
//                 <StatCard label="Net Cost"        value={`${cc.netCost < 0 ? "-" : "+"}$${Math.abs(cc.netCost).toLocaleString()}`} unit="" color={cc.netCost < 0 ? "#00d4aa" : "#ffb347"} sub={cc.netCost < 0 ? "Net savings" : "Net expense"} />
//                 <StatCard label="Net CO₂ Change"  value={`${cc.netCo2 < 0 ? "-" : "+"}${Math.abs(Math.round(cc.netCo2 / 1000))} t`} unit="" color={cc.netCo2 < 0 ? "#00d4aa" : "#ff4d6a"} sub={cc.netCo2 < 0 ? "Emissions avoided" : "Extra emissions"} />
//             </div>
//
//             <div style={S.statsRow}>
//                 <StatCard label="EV Load Shifted"  value={totalEvShifted.toLocaleString()} unit="MW·h" color="#00d4aa" sub={`+${params.evDelayHours}h delay`} />
//                 <StatCard label="Industrial Cut"   value={totalIndCut.toLocaleString()}    unit="MW·h" color="#ffb347" sub={`${params.industrialCutPct}% curtailed`} />
//                 <StatCard label="Residential Flex" value={totalResFlex.toLocaleString()}   unit="MW·h" color="#4da6ff" sub={`${params.residentialFlexPct}% opt-in`} />
//                 <StatCard label="Overload Hours"   value={overloadHours}                   unit="hrs"  color={overloadHours === 0 ? "#00d4aa" : "#ff4d6a"} sub={overloadHours === 0 ? "All hours safe" : "Still at risk"} />
//             </div>
//
//             {/* Main layout */}
//             <div style={S.grid}>
//
//                 {/* Left: Controls + Cost/Carbon */}
//                 <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//
//                     {/* Sliders */}
//                     <div style={S.panel}>
//                         <div style={S.panelTitle}><span style={dotStyle("#00d4aa")} /> EV Charging</div>
//                         <Slider label="Shift Delay"        value={params.evDelayHours}       min={1}    max={6}     unit="h"   color="#00d4aa" onChange={set("evDelayHours")}       description="hours to delay" />
//                         <Slider label="Participation Rate" value={params.evShiftPct}          min={0}    max={100}   unit="%"   color="#00d4aa" onChange={set("evShiftPct")}           description="% EVs that shift" />
//                         <div style={S.divider} />
//                         <div style={S.panelTitle}><span style={dotStyle("#ffb347")} /> Industrial Load</div>
//                         <Slider label="Curtailment"        value={params.industrialCutPct}   min={0}    max={40}    unit="%"   color="#ffb347" onChange={set("industrialCutPct")}   description="% reduction" />
//                         <div style={S.divider} />
//                         <div style={S.panelTitle}><span style={dotStyle("#4da6ff")} /> Residential Flex</div>
//                         <Slider label="Opt-in Rate"        value={params.residentialFlexPct} min={0}    max={20}    unit="%"   color="#4da6ff" onChange={set("residentialFlexPct")} description="% households" />
//                         <div style={S.divider} />
//                         <div style={S.panelTitle}><span style={dotStyle("#ff4d6a")} /> Backup Generation</div>
//                         <Slider label="Available Capacity" value={params.backupSupplyMw}     min={0}    max={2000}  step={50} unit=" MW" color="#ff4d6a" onChange={set("backupSupplyMw")}     description="peaker MW" />
//                         <div style={S.divider} />
//                         <div style={S.panelTitle}><span style={dotStyle("#888")} /> Grid Settings</div>
//                         <Slider label="Grid Capacity"      value={params.capacityMw}         min={8000} max={15000} step={100} unit=" MW" color="#aaa"    onChange={set("capacityMw")}          description="hard limit" />
//                     </div>
//
//                     {/* Cost breakdown */}
//                     <div style={S.panel}>
//                         <div style={S.panelTitle}><span style={dotStyle("#ffb347")} /> Cost Analysis</div>
//                         <CostRow label="Backup generation" value={cc.backupCost}      color="#ff4d6a" positive />
//                         <CostRow label="EV delay incentive" value={cc.evIncentiveCost} color="#ffb347" positive />
//                         <CostRow label="Industrial savings" value={-cc.industrySavings} color="#00d4aa" />
//                         <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 4 }}>
//                             <span style={{ fontSize: 12, fontWeight: 500, color: "#e8f4f1" }}>Net cost</span>
//                             <span style={{ fontFamily: "monospace", fontSize: 15, color: cc.netCost < 0 ? "#00d4aa" : "#ffb347", fontWeight: 500 }}>
//                                 {cc.netCost < 0 ? "-" : "+"}${Math.abs(cc.netCost).toLocaleString()}
//                             </span>
//                         </div>
//                         <div style={{ marginTop: 12 }}>
//                             <ResponsiveContainer width="100%" height={80}>
//                                 <BarChart data={costBreakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
//                                     <XAxis dataKey="name" tick={{ fill: "rgba(232,244,241,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} />
//                                     <YAxis hide />
//                                     <Tooltip formatter={(v: any) => [`$${Math.abs(v).toLocaleString()}`, ""]} contentStyle={{ background: "#0d1821", border: "1px solid rgba(0,212,170,0.2)", fontSize: 11 }} />
//                                     <Bar dataKey="value" radius={[3, 3, 0, 0]}>
//                                         {costBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.8} />)}
//                                     </Bar>
//                                 </BarChart>
//                             </ResponsiveContainer>
//                         </div>
//                     </div>
//
//                     {/* Carbon tracker */}
//                     <div style={S.panel}>
//                         <div style={S.panelTitle}><span style={dotStyle("#4da6ff")} /> Carbon Impact</div>
//                         <div style={{ marginBottom: 10 }}>
//                             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
//                                 <span style={{ color: "rgba(232,244,241,0.5)" }}>CO₂ from backup gen</span>
//                                 <span style={{ fontFamily: "monospace", color: "#ff4d6a" }}>{(cc.co2FromBackup / 1000).toFixed(1)} t</span>
//                             </div>
//                             <div style={S.co2Bar}>
//                                 <div style={{ height: "100%", width: `${Math.min((cc.co2FromBackup / 5000) * 100, 100)}%`, background: "#ff4d6a", borderRadius: 4, transition: "width 0.4s" }} />
//                             </div>
//                         </div>
//                         <div style={{ marginBottom: 10 }}>
//                             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
//                                 <span style={{ color: "rgba(232,244,241,0.5)" }}>CO₂ avoided from demand reduction</span>
//                                 <span style={{ fontFamily: "monospace", color: "#00d4aa" }}>{(cc.co2Avoided / 1000).toFixed(1)} t</span>
//                             </div>
//                             <div style={S.co2Bar}>
//                                 <div style={{ height: "100%", width: `${Math.min((cc.co2Avoided / 5000) * 100, 100)}%`, background: "#00d4aa", borderRadius: 4, transition: "width 0.4s" }} />
//                             </div>
//                         </div>
//                         <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 4 }}>
//                             <span style={{ fontSize: 12, fontWeight: 500, color: "#e8f4f1" }}>Net CO₂ change</span>
//                             <span style={{ fontFamily: "monospace", fontSize: 15, color: cc.netCo2 < 0 ? "#00d4aa" : "#ff4d6a", fontWeight: 500 }}>
//                                 {cc.netCo2 < 0 ? "-" : "+"}{Math.abs(Math.round(cc.netCo2 / 1000))} t
//                             </span>
//                         </div>
//                         <div style={{ fontSize: 10, color: "rgba(232,244,241,0.3)", marginTop: 8 }}>
//                             Based on {CO2_KG_PER_MWH_BACKUP} kg/MWh gas peaker · {CO2_KG_PER_MWH_SAVED} kg/MWh grid average
//                         </div>
//                     </div>
//                 </div>
//
//                 {/* Right: Charts */}
//                 <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//
//                     {/* Before vs After */}
//                     <div style={S.panel}>
//                         <div style={S.panelTitle}><span style={dotStyle("#00d4aa")} /> 24-Hour Demand Curve — Before vs After</div>
//                         <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
//                             {[{ color: "#ff4d6a", label: "Original" }, { color: "#00d4aa", label: "Adjusted" }, { color: "rgba(255,77,106,0.5)", label: "Capacity" }].map(l => (
//                                 <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
//                                     <div style={{ width: 16, height: 2, background: l.color }} />{l.label}
//                                 </div>
//                             ))}
//                         </div>
//                         <ResponsiveContainer width="100%" height={220}>
//                             <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
//                                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
//                                 <XAxis dataKey="label" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} interval={3} />
//                                 <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} domain={[4000, Math.max(params.capacityMw + 1500, peakOriginal + 500)]} width={38} />
//                                 <Tooltip content={<CustomTooltip />} />
//                                 <ReferenceLine y={params.capacityMw} stroke="rgba(255,77,106,0.6)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `${(params.capacityMw / 1000).toFixed(0)}K MW`, fill: "#ff4d6a", fontSize: 9, position: "insideTopRight" }} />
//                                 <Area type="monotone" dataKey="Original Demand" stroke="#ff4d6a" fill="rgba(255,77,106,0.07)" strokeWidth={2} dot={false} />
//                                 <Line type="monotone" dataKey="Adjusted Demand" stroke="#00d4aa" strokeWidth={2.5} dot={false} />
//                             </ComposedChart>
//                         </ResponsiveContainer>
//                     </div>
//
//                     {/* Savings stacked */}
//                     <div style={S.panel}>
//                         <div style={S.panelTitle}><span style={dotStyle("#4da6ff")} /> Hourly Savings by Intervention Type</div>
//                         <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
//                             {[{ color: "#00d4aa", label: "EV shifted" }, { color: "#ffb347", label: "Industrial cut" }, { color: "#4da6ff", label: "Residential flex" }, { color: "#ff4d6a", label: "Backup supply" }].map(l => (
//                                 <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
//                                     <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
//                                 </div>
//                             ))}
//                         </div>
//                         <ResponsiveContainer width="100%" height={180}>
//                             <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
//                                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
//                                 <XAxis dataKey="label" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} interval={3} />
//                                 <YAxis tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={38} />
//                                 <Tooltip content={<CustomTooltip />} />
//                                 <Area type="monotone" dataKey="EV Shifted"      stroke="#00d4aa" fill="rgba(0,212,170,0.25)"   strokeWidth={1} dot={false} stackId="1" />
//                                 <Area type="monotone" dataKey="Industrial Cut"  stroke="#ffb347" fill="rgba(255,179,71,0.25)"  strokeWidth={1} dot={false} stackId="1" />
//                                 <Area type="monotone" dataKey="Residential Flex" stroke="#4da6ff" fill="rgba(77,166,255,0.25)" strokeWidth={1} dot={false} stackId="1" />
//                                 <Area type="monotone" dataKey="Backup Supply"   stroke="#ff4d6a" fill="rgba(255,77,106,0.25)"  strokeWidth={1} dot={false} stackId="1" />
//                             </ComposedChart>
//                         </ResponsiveContainer>
//                     </div>
//
//                     {/* Hourly status strip */}
//                     <div style={S.panel}>
//                         <div style={S.panelTitle}><span style={dotStyle(overloadHours === 0 ? "#00d4aa" : "#ff4d6a")} /> Hourly Grid Status After Interventions</div>
//                         <div style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0,1fr))", gap: 3 }}>
//                             {simHours.map((h, i) => {
//                                 const ratio = Math.min((h.final - 4000) / (params.capacityMw - 4000), 1);
//                                 const isOver = h.overCapacity;
//                                 return (
//                                     <div key={i} title={`${h.label}: ${h.final.toLocaleString()} MW${isOver ? " ⚠ OVER CAPACITY" : ""}`}
//                                          style={{
//                                              height: 44, borderRadius: 3,
//                                              background: isOver ? "rgba(255,77,106,0.7)" : `rgba(0,212,170,${0.15 + ratio * 0.6})`,
//                                              border: isOver ? "1px solid rgba(255,77,106,0.8)" : "1px solid transparent",
//                                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
//                                              paddingBottom: 3, cursor: "default",
//                                          }}>
//                                         <span style={{ fontFamily: "monospace", fontSize: 7, color: isOver ? "#ff4d6a" : "rgba(232,244,241,0.5)" }}>{i}</span>
//                                     </div>
//                                 );
//                             })}
//                         </div>
//                         <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "rgba(232,244,241,0.4)" }}>
//                             <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(0,212,170,0.6)", display: "inline-block" }} /> Safe</span>
//                             <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,77,106,0.7)", display: "inline-block" }} /> Over capacity</span>
//                             <span style={{ marginLeft: "auto", fontFamily: "monospace" }}>Hover each cell for MW value</span>
//                         </div>
//                     </div>
//
//                 </div>
//             </div>
//         </div>
//     );
// }