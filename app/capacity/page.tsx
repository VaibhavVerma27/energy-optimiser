"use client";

import { useEffect, useState } from "react";
import {
    fetchAllRegionsCapacity, fetchCapacity24h,
    type AllRegionsCapacity, type CapacityHour,
} from "../../lib/api";
import {
    ResponsiveContainer, ComposedChart, Area, Line, Bar, BarChart,
    XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";

const REGIONS = [
    { id: "Northern_Region",     label: "Northern",      short: "NR",  color: "#4da6ff" },
    { id: "Western_Region",      label: "Western",       short: "WR",  color: "#ffb347" },
    { id: "Southern_Region",     label: "Southern",      short: "SR",  color: "#00d4aa" },
    { id: "Eastern_Region",      label: "Eastern",       short: "ER",  color: "#ff4d6a" },
    { id: "NorthEastern_Region", label: "North-Eastern", short: "NER", color: "#c084fc" },
];

const SOURCE_COLORS: Record<string, string> = {
    thermal: "#ff6b35",
    solar:   "#ffd60a",
    wind:    "#4da6ff",
    hydro:   "#00d4aa",
    nuclear: "#c084fc",
    other:   "#888",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function NavLink({href,label,active}:{href:string;label:string;active?:boolean}) {
    return (
        <a href={href} style={{
            fontFamily:"monospace", fontSize:10, letterSpacing:"0.08em",
            textDecoration:"none", padding:"4px 12px", borderRadius:5,
            background: active?"rgba(0,212,170,0.12)":"transparent",
            color: active?"#00d4aa":"rgba(232,244,241,0.4)",
            border: active?"1px solid rgba(0,212,170,0.25)":"1px solid transparent",
        }}>{label}</a>
    );
}

const CustomTooltip = ({active,payload,label}:any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{background:"#0d1821", border:"1px solid rgba(0,212,170,0.25)", borderRadius:6, padding:"10px 14px", fontSize:11}}>
            <p style={{color:"#00d4aa", marginBottom:6, fontFamily:"monospace"}}>{label}</p>
            {payload.map((p:any) => (
                <p key={p.name} style={{color:p.color??p.fill??"#e8f4f1", margin:"2px 0"}}>
                    {p.name}: <strong>{typeof p.value === "number" ? `${p.value.toLocaleString()} MW` : p.value}</strong>
                </p>
            ))}
        </div>
    );
};

export default function CapacityPage() {
    const [allCap, setAllCap]       = useState<AllRegionsCapacity|null>(null);
    const [cap24h, setCap24h]       = useState<CapacityHour[]>([]);
    const [selectedRegion, setRegion] = useState("Northern_Region");
    const [selectedMonth, setMonth]   = useState<number>(new Date().getMonth()+1);
    const [loading, setLoading]       = useState(true);
    const [lastRefresh, setLastRefresh] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const [ac, c24] = await Promise.all([
                fetchAllRegionsCapacity(),
                fetchCapacity24h(selectedRegion, selectedMonth),
            ]);
            setAllCap(ac);
            setCap24h(c24.hours);
            setLastRefresh(new Date().toLocaleTimeString());
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(()=>{ load(); }, [selectedRegion, selectedMonth]);

    const S: Record<string, React.CSSProperties> = {
        root: {minHeight:"100vh", background:"#0a0f14", color:"#e8f4f1", fontFamily:"'Exo 2','Segoe UI',sans-serif", padding:"20px 24px"},
        header: {display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, paddingBottom:14, borderBottom:"1px solid rgba(255,255,255,0.08)"},
        title: {fontFamily:"monospace", fontSize:13, letterSpacing:"0.15em", color:"#00d4aa", textTransform:"uppercase"},
        panel: {background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:16},
        panelTitle: {fontSize:10, letterSpacing:"0.12em", color:"rgba(232,244,241,0.45)", textTransform:"uppercase", marginBottom:12},
        twoCol: {display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14},
        threeCol: {display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:14, marginBottom:14},
        fiveCol: {display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:10, marginBottom:14},
        select: {background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#e8f4f1", borderRadius:6, padding:"4px 10px", fontSize:11, fontFamily:"monospace"},
    };

    // Build stacked chart data
    const stackedData = cap24h.map(h => ({
        label: h.label,
        Thermal: h.breakdown_mw.thermal ?? 0,
        Hydro:   h.breakdown_mw.hydro   ?? 0,
        Solar:   h.breakdown_mw.solar   ?? 0,
        Wind:    h.breakdown_mw.wind    ?? 0,
        Nuclear: h.breakdown_mw.nuclear ?? 0,
        Other:   h.breakdown_mw.other   ?? 0,
    }));

    // CF chart data
    const cfData = cap24h.map(h => ({
        label:    h.label,
        "Solar CF":   Math.round(h.solar_cf * 100),
        "Wind CF":    Math.round(h.wind_cf * 100),
        "Hydro CF":   Math.round(h.hydro_cf * 100),
        "Thermal CF": Math.round(h.thermal_cf * 100),
    }));

    const currentRegionCap = allCap?.regions?.[selectedRegion];
    const allIndia = allCap?.all_india;

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={S.header}>
                <div>
                    <div style={S.title}>⚡ Dynamic Grid Capacity — India POSOCO</div>
                    <div style={{fontSize:11, color:"rgba(232,244,241,0.4)", marginTop:3, fontFamily:"monospace"}}>
                        Real-time available capacity based on solar irradiance · wind speed · hydro reservoirs · thermal PLF
                        {lastRefresh && ` · ${lastRefresh}`}
                    </div>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <NavLink href="/" label="Dashboard" />
                    <NavLink href="/simulation" label="Simulator" />
                    <NavLink href="/capacity" label="Capacity" active />
                    <NavLink href="/insights" label="ML Insights" />
                    <NavLink href="/history" label="History" />
                </div>
            </div>

            {/* Controls */}
            <div style={{display:"flex", gap:12, marginBottom:16, alignItems:"center"}}>
                <span style={{fontSize:11, color:"rgba(232,244,241,0.5)"}}>Region:</span>
                <select value={selectedRegion} onChange={e=>setRegion(e.target.value)} style={S.select}>
                    {REGIONS.map(r=><option key={r.id} value={r.id}>{r.label} Region</option>)}
                </select>
                <span style={{fontSize:11, color:"rgba(232,244,241,0.5)"}}>Month:</span>
                <select value={selectedMonth} onChange={e=>setMonth(Number(e.target.value))} style={S.select}>
                    {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                </select>
                <button onClick={load} style={{background:"transparent", border:"1px solid rgba(0,212,170,0.3)", color:"#00d4aa", borderRadius:6, padding:"4px 12px", fontFamily:"monospace", fontSize:10, cursor:"pointer"}}>
                    {loading?"Loading…":"Refresh"}
                </button>
            </div>

            {/* All-India snapshot cards */}
            {allIndia && (
                <div style={S.fiveCol}>
                    {[
                        {label:"Total Available",  value:`${(allIndia.total_available_mw/1000).toFixed(0)} GW`, color:"#00d4aa", sub:"All India right now"},
                        {label:"Renewable",        value:`${(allIndia.renewable_mw/1000).toFixed(0)} GW`,       color:"#4da6ff", sub:`${allIndia.renewable_pct}% of available`},
                        {label:"Thermal",          value:`${(allIndia.thermal_mw/1000).toFixed(0)} GW`,          color:"#ff6b35", sub:"Coal + Gas + Oil"},
                        {label:"Renewable %",      value:`${allIndia.renewable_pct}%`,                            color:"#00d4aa", sub:"Of available capacity"},
                        {label:"Installed Total",  value:`${(allIndia.installed_mw/1000).toFixed(0)} GW`,        color:"rgba(232,244,241,0.5)", sub:"CEA 2023-24"},
                    ].map(s=>(
                        <div key={s.label} style={{background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"12px 14px", borderTop:`2px solid ${s.color}`}}>
                            <div style={{fontSize:9, color:"rgba(232,244,241,0.4)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4}}>{s.label}</div>
                            <div style={{fontFamily:"monospace", fontSize:20, color:s.color}}>{s.value}</div>
                            <div style={{fontSize:9, color:"rgba(232,244,241,0.35)", marginTop:2}}>{s.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* All-region capacity cards */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:10, marginBottom:14}}>
                {REGIONS.map(r=>{
                    const cap = allCap?.regions?.[r.id];
                    const renewPct = cap ? Math.round((cap.renewable_mw / cap.total_available_mw)*100) : 0;
                    const alerts = cap?.alerts ?? [];
                    return (
                        <div key={r.id} onClick={()=>setRegion(r.id)} style={{
                            background: selectedRegion===r.id?`${r.color}10`:"rgba(255,255,255,0.025)",
                            border:`1px solid ${selectedRegion===r.id?r.color+"50":"rgba(255,255,255,0.07)"}`,
                            borderLeft:`3px solid ${r.color}`, borderRadius:8, padding:"12px 14px", cursor:"pointer",
                        }}>
                            <div style={{fontFamily:"monospace", fontSize:9, color:r.color, marginBottom:3}}>{r.short}</div>
                            <div style={{fontSize:12, fontWeight:500, color:"#e8f4f1", marginBottom:8}}>{r.label}</div>
                            {cap ? (
                                <>
                                    <div style={{fontFamily:"monospace", fontSize:18, color:r.color, marginBottom:4}}>
                                        {(cap.total_available_mw/1000).toFixed(1)} GW
                                    </div>
                                    <div style={{fontSize:10, color:"rgba(232,244,241,0.4)", marginBottom:6}}>available now</div>
                                    {/* Source mini-bars */}
                                    {["thermal","solar","wind","hydro"].map(src=>{
                                        const mw  = cap.breakdown_mw[src] ?? 0;
                                        const pct = Math.round((mw/cap.total_available_mw)*100);
                                        return (
                                            <div key={src} style={{display:"flex", alignItems:"center", gap:5, marginBottom:3}}>
                                                <div style={{width:6, height:6, borderRadius:1, background:SOURCE_COLORS[src], flexShrink:0}} />
                                                <div style={{flex:1, height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden"}}>
                                                    <div style={{height:"100%", width:`${pct}%`, background:SOURCE_COLORS[src], opacity:0.7}} />
                                                </div>
                                                <span style={{fontFamily:"monospace", fontSize:9, color:"rgba(232,244,241,0.4)", width:30}}>{pct}%</span>
                                            </div>
                                        );
                                    })}
                                    {alerts.length > 0 && (
                                        <div style={{marginTop:6, fontSize:9, color:"#ffb347", lineHeight:1.5}}>
                                            {alerts[0]}
                                        </div>
                                    )}
                                </>
                            ) : <div style={{fontSize:11, color:"rgba(232,244,241,0.3)"}}>Loading…</div>}
                        </div>
                    );
                })}
            </div>

            {/* 24h stacked capacity chart */}
            <div style={{...S.panel, marginBottom:14}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                    <div style={S.panelTitle}>
                        24-Hour Available Capacity Stack — {REGIONS.find(r=>r.id===selectedRegion)?.label} Region · {MONTHS[selectedMonth-1]}
                    </div>
                    <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
                        {Object.entries(SOURCE_COLORS).map(([src,col])=>(
                            <div key={src} style={{display:"flex", alignItems:"center", gap:4, fontSize:10, color:"rgba(232,244,241,0.5)"}}>
                                <div style={{width:8, height:8, borderRadius:2, background:col}} />
                                {src.charAt(0).toUpperCase()+src.slice(1)}
                            </div>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stackedData} margin={{top:4, right:12, left:0, bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)", fontSize:9, fontFamily:"monospace"}} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tickFormatter={(v:number)=>`${(v/1000).toFixed(0)}K`} tick={{fill:"rgba(232,244,241,0.35)", fontSize:9, fontFamily:"monospace"}} axisLine={false} tickLine={false} width={38} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Thermal" stackId="a" fill={SOURCE_COLORS.thermal} fillOpacity={0.85} />
                        <Bar dataKey="Hydro"   stackId="a" fill={SOURCE_COLORS.hydro}   fillOpacity={0.85} />
                        <Bar dataKey="Nuclear" stackId="a" fill={SOURCE_COLORS.nuclear} fillOpacity={0.85} />
                        <Bar dataKey="Wind"    stackId="a" fill={SOURCE_COLORS.wind}    fillOpacity={0.85} />
                        <Bar dataKey="Solar"   stackId="a" fill={SOURCE_COLORS.solar}   fillOpacity={0.85} radius={[3,3,0,0]} />
                        <Bar dataKey="Other"   stackId="a" fill={SOURCE_COLORS.other}   fillOpacity={0.85} />
                    </BarChart>
                </ResponsiveContainer>
                <div style={{marginTop:10, fontSize:10, color:"rgba(232,244,241,0.35)"}}>
                    Solar output drops to zero at night. Wind peaks during monsoon months. Hydro peaks post-monsoon (Sep-Nov). Thermal remains relatively stable with scheduled maintenance dips in Mar-May.
                </div>
            </div>

            {/* Capacity factor chart */}
            <div style={S.twoCol}>
                <div style={S.panel}>
                    <div style={S.panelTitle}>Capacity Factors by Source — Hourly Variation</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={cfData} margin={{top:4, right:12, left:0, bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)", fontSize:9, fontFamily:"monospace"}} axisLine={false} tickLine={false} interval={3} />
                            <YAxis tickFormatter={(v:number)=>`${v}%`} tick={{fill:"rgba(232,244,241,0.35)", fontSize:9, fontFamily:"monospace"}} axisLine={false} tickLine={false} width={38} domain={[0,100]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="Solar CF"   stroke={SOURCE_COLORS.solar}   fill={SOURCE_COLORS.solar+"22"}  strokeWidth={2} dot={false} />
                            <Line  type="monotone" dataKey="Wind CF"    stroke={SOURCE_COLORS.wind}    strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                            <Line  type="monotone" dataKey="Hydro CF"   stroke={SOURCE_COLORS.hydro}   strokeWidth={1.5} dot={false} />
                            <Line  type="monotone" dataKey="Thermal CF" stroke={SOURCE_COLORS.thermal} strokeWidth={1.5} dot={false} strokeDasharray="2 3" />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{marginTop:8, display:"flex", gap:12, flexWrap:"wrap"}}>
                        {[{col:SOURCE_COLORS.solar,label:"Solar (bell curve)"}, {col:SOURCE_COLORS.wind,label:"Wind (slight diurnal)"}, {col:SOURCE_COLORS.hydro,label:"Hydro (dispatchable)"}, {col:SOURCE_COLORS.thermal,label:"Thermal (stable)"}].map(l=>(
                            <div key={l.label} style={{display:"flex", alignItems:"center", gap:4, fontSize:10, color:"rgba(232,244,241,0.5)"}}>
                                <div style={{width:12, height:2, background:l.col}} />{l.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monthly renewable share */}
                <div style={S.panel}>
                    <div style={S.panelTitle}>Why Capacity Varies — Seasonal Logic</div>
                    <div style={{display:"flex", flexDirection:"column", gap:10}}>
                        {[
                            {icon:"☀", color:SOURCE_COLORS.solar, title:"Solar", detail:"Bell curve: zero at night, peaks at 12:00. Pre-monsoon (Apr-Jun) highest. Monsoon 40-60% drop from cloud cover. Western region best (Rajasthan/Gujarat irradiance)."},
                            {icon:"💨", color:SOURCE_COLORS.wind,  title:"Wind",  detail:"70% of annual output May-Sep (SW Monsoon). Western (Gujarat coast) and Southern (Tamil Nadu, Western Ghats) dominate. National average CUF ~18% (CERC 2022-23)."},
                            {icon:"💧", color:SOURCE_COLORS.hydro,  title:"Hydro", detail:"Reservoir hydro peaks Oct-Nov (full reservoirs post-monsoon). Pre-monsoon (Apr-Jun) lowest. NE region run-of-river peaks during Jul-Aug monsoon."},
                            {icon:"🔥", color:SOURCE_COLORS.thermal,title:"Thermal", detail:"Average PLF ~58% (CERC). Planned maintenance Mar-May. Coal-dominant regions (Eastern, Northern) most reliable. Forced outages ~0-8% random daily."},
                        ].map(s=>(
                            <div key={s.title} style={{display:"flex", gap:10, padding:"8px 10px", background:"rgba(255,255,255,0.02)", borderRadius:6, borderLeft:`3px solid ${s.color}`}}>
                                <span style={{fontSize:16, flexShrink:0}}>{s.icon}</span>
                                <div>
                                    <div style={{fontSize:11, fontWeight:500, color:s.color, marginBottom:2}}>{s.title}</div>
                                    <div style={{fontSize:10, color:"rgba(232,244,241,0.55)", lineHeight:1.5}}>{s.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Active alerts */}
            {currentRegionCap && currentRegionCap.alerts.length > 0 && (
                <div style={{...S.panel, marginBottom:14}}>
                    <div style={S.panelTitle}>Active Capacity Alerts — {REGIONS.find(r=>r.id===selectedRegion)?.label} Region</div>
                    <div style={{display:"flex", flexDirection:"column", gap:6}}>
                        {currentRegionCap.alerts.map((a,i)=>(
                            <div key={i} style={{
                                padding:"8px 12px", borderRadius:6, fontSize:11,
                                background: a.includes("🔴")?"rgba(255,77,106,0.1)": a.includes("⚠")?"rgba(255,179,71,0.08)":"rgba(0,212,170,0.06)",
                                color: a.includes("🔴")?"#ff4d6a": a.includes("⚠")?"#ffb347":"#00d4aa",
                                border: `1px solid ${a.includes("🔴")?"rgba(255,77,106,0.3)": a.includes("⚠")?"rgba(255,179,71,0.2)":"rgba(0,212,170,0.15)"}`,
                            }}>{a}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}