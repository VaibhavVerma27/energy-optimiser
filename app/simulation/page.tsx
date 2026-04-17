"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAllRegions, type AllRegionsForecast } from "../../lib/api";
import {
    ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar,
    ReferenceLine, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

// ── India constants ───────────────────────────────────────────────────────────
const REGIONS = [
    { col:"Northern_Region_mw",    id:"Northern_Region",    label:"Northern",  color:"#4da6ff", capacity:115000 },
    { col:"Western_Region_mw",     id:"Western_Region",     label:"Western",   color:"#ffb347", capacity:130000 },
    { col:"Southern_Region_mw",    id:"Southern_Region",    label:"Southern",  color:"#00d4aa", capacity:95000  },
    { col:"Eastern_Region_mw",     id:"Eastern_Region",     label:"Eastern",   color:"#ff4d6a", capacity:55000  },
    { col:"NorthEastern_Region_mw",id:"NorthEastern_Region",label:"NE Region", color:"#c084fc", capacity:4500   },
];

// India cost/carbon constants
const COST_EV_INR_PER_MWH    = 600;
const COST_AGRI_INR_PER_MWH  = 400;
const COST_IND_SAVE_INR_MWH  = 2200;
const COST_BACKUP_INR_PER_MWH= 8500;
const CO2_BACKUP_KG_MWH      = 490;
const CO2_GRID_KG_MWH        = 820;

// Segment shares (India)
const SEGMENTS = { residential:0.26, industrial:0.45, agriculture:0.18, commercial:0.11, ev:0.04 };

// ── Types ─────────────────────────────────────────────────────────────────────
interface SimParams {
    evDelayHours:         number;
    evShiftPct:           number;
    agriShiftPct:         number;
    industrialCutPct:     number;
    residentialFlexPct:   number;
    backupSupplyMw:       number;
}

interface SimHour {
    label:           string;
    hour:            number;
    original:        number;
    dynamicCap:      number;   // per-hour capacity from forecast
    ev_shifted:      number;
    agri_shifted:    number;
    industrial_cut:  number;
    residential_flex:number;
    backup_added:    number;
    final:           number;
    overCapacity:    boolean;
    saving:          number;
    solar_mw:        number;
    wind_mw:         number;
    hydro_mw:        number;
    thermal_mw:      number;
}

// ── Simulation engine ─────────────────────────────────────────────────────────
function runSimulation(
    forecast: any[],
    params: SimParams,
): SimHour[] {
    const n = forecast.length;
    // Use per-hour dynamic capacity from forecast data
    const demand   = forecast.map(f => f.predicted_demand_mw);
    const caps     = forecast.map(f => f.capacity_mw ?? 95000);
    const result: SimHour[] = [];

    // Mutable demand array
    const adj = [...demand];

    const evShifted       = new Array(n).fill(0);
    const agriShifted     = new Array(n).fill(0);
    const indCut          = new Array(n).fill(0);
    const resFlex         = new Array(n).fill(0);
    const backupAdded     = new Array(n).fill(0);

    // 1. EV delay
    for (let i = 0; i < n; i++) {
        const evLoad = demand[i] * SEGMENTS.ev * (params.evShiftPct / 100);
        adj[i] -= evLoad;
        evShifted[i] = evLoad;
        const tgt = Math.min(i + params.evDelayHours, n - 1);
        adj[tgt] += evLoad;
    }

    // 2. Agricultural pump shift
    for (let i = 0; i < n; i++) {
        if (adj[i] > caps[i]) {
            const cut = demand[i] * SEGMENTS.agriculture * (params.agriShiftPct / 100);
            adj[i] -= cut;
            agriShifted[i] = cut;
        }
    }

    // 3. Industrial curtailment
    for (let i = 0; i < n; i++) {
        if (adj[i] > caps[i]) {
            const cut = demand[i] * SEGMENTS.industrial * (params.industrialCutPct / 100);
            adj[i] -= cut;
            indCut[i] = cut;
        }
    }

    // 4. Residential flex
    for (let i = 0; i < n; i++) {
        if (adj[i] > caps[i]) {
            const cut = demand[i] * SEGMENTS.residential * (params.residentialFlexPct / 100);
            adj[i] -= cut;
            resFlex[i] = cut;
        }
    }

    // 5. Backup generation
    for (let i = 0; i < n; i++) {
        if (adj[i] > caps[i]) {
            const add = Math.min(adj[i] - caps[i], params.backupSupplyMw);
            adj[i] -= add;
            backupAdded[i] = add;
        }
    }

    for (let i = 0; i < n; i++) {
        result.push({
            label:            forecast[i].label,
            hour:             i,
            original:         Math.round(demand[i]),
            dynamicCap:       Math.round(caps[i]),
            ev_shifted:       Math.round(evShifted[i]),
            agri_shifted:     Math.round(agriShifted[i]),
            industrial_cut:   Math.round(indCut[i]),
            residential_flex: Math.round(resFlex[i]),
            backup_added:     Math.round(backupAdded[i]),
            final:            Math.round(adj[i]),
            overCapacity:     adj[i] > caps[i],
            saving:           Math.round(demand[i] - adj[i]),
            solar_mw:         forecast[i].solar_available_mw ?? 0,
            wind_mw:          forecast[i].wind_available_mw  ?? 0,
            hydro_mw:         forecast[i].hydro_available_mw ?? 0,
            thermal_mw:       forecast[i].thermal_available_mw ?? 0,
        });
    }
    return result;
}

function calcCosts(hours: SimHour[]) {
    const totalEvMwh    = hours.reduce((s,h)=>s+h.ev_shifted,0)    / 1000;
    const totalAgriMwh  = hours.reduce((s,h)=>s+h.agri_shifted,0)  / 1000;
    const totalIndMwh   = hours.reduce((s,h)=>s+h.industrial_cut,0)/ 1000;
    const totalBackupMwh= hours.reduce((s,h)=>s+h.backup_added,0)  / 1000;
    const backupCost    = Math.round(totalBackupMwh * COST_BACKUP_INR_PER_MWH);
    const evCost        = Math.round(totalEvMwh    * COST_EV_INR_PER_MWH);
    const agriCost      = Math.round(totalAgriMwh  * COST_AGRI_INR_PER_MWH);
    const indSaving     = Math.round(totalIndMwh   * COST_IND_SAVE_INR_MWH);
    const netCost       = backupCost + evCost + agriCost - indSaving;
    const co2Backup     = Math.round(totalBackupMwh * CO2_BACKUP_KG_MWH);
    const co2Avoided    = Math.round(hours.reduce((s,h)=>s+h.saving,0)/1000 * CO2_GRID_KG_MWH);
    return { backupCost, evCost, agriCost, indSaving, netCost, co2Backup, co2Avoided, netCo2: co2Backup - co2Avoided };
}

// ── Sub-components ────────────────────────────────────────────────────────────
const Tip = ({active,payload,label}:any) => {
    if (!active||!payload?.length) return null;
    return (
        <div style={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.25)",borderRadius:6,padding:"10px 14px",fontSize:11}}>
            <p style={{color:"#00d4aa",marginBottom:6,fontFamily:"monospace"}}>{label}</p>
            {payload.map((p:any)=>(
                <p key={p.name} style={{color:p.color??p.fill??"#e8f4f1",margin:"2px 0"}}>
                    {p.name}: <strong>{typeof p.value==="number"?`${p.value.toLocaleString()} MW`:p.value}</strong>
                </p>
            ))}
        </div>
    );
};

function Slider({label,value,min,max,step=1,unit="%",color="#00d4aa",onChange,description}:{
    label:string;value:number;min:number;max:number;
    step?:number;unit?:string;color?:string;
    onChange:(v:number)=>void;description:string;
}) {
    return (
        <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12,color:"#e8f4f1",fontWeight:500}}>{label}</span>
                <span style={{fontFamily:"monospace",fontSize:12,color}}>{value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                   onChange={e=>onChange(Number(e.target.value))}
                   style={{width:"100%",accentColor:color}} />
            <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
                <span style={{fontSize:9,color:"rgba(232,244,241,0.35)"}}>{min}{unit}</span>
                <span style={{fontSize:9,color:"rgba(232,244,241,0.35)"}}>{description}</span>
                <span style={{fontSize:9,color:"rgba(232,244,241,0.35)"}}>{max}{unit}</span>
            </div>
        </div>
    );
}

function KPICard({label,value,color,sub}:{label:string;value:string|number;color:string;sub?:string}) {
    return (
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"11px 13px",borderTop:`2px solid ${color}`}}>
            <div style={{fontSize:9,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{label}</div>
            <div style={{fontFamily:"monospace",fontSize:18,color}}>{typeof value==="number"?value.toLocaleString():value}</div>
            {sub&&<div style={{fontSize:9,color:"rgba(232,244,241,0.35)",marginTop:2}}>{sub}</div>}
        </div>
    );
}

function NavLink({href,label,active}:{href:string;label:string;active?:boolean}) {
    return (
        <a href={href} style={{
            fontFamily:"monospace",fontSize:10,letterSpacing:"0.08em",
            textDecoration:"none",padding:"4px 12px",borderRadius:5,
            background:active?"rgba(0,212,170,0.12)":"transparent",
            color:active?"#00d4aa":"rgba(232,244,241,0.4)",
            border:active?"1px solid rgba(0,212,170,0.25)":"1px solid transparent",
        }}>{label}</a>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SimulationPage() {
    const [allForecast, setAllForecast] = useState<AllRegionsForecast|null>(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState<string|null>(null);
    const [selectedRegion, setRegion]   = useState("Northern_Region_mw");
    const [params, setParams]           = useState<SimParams>({
        evDelayHours:2, evShiftPct:100, agriShiftPct:10,
        industrialCutPct:15, residentialFlexPct:5, backupSupplyMw:2000,
    });

    useEffect(()=>{
        fetchAllRegions()
            .then(setAllForecast)
            .catch(e=>setError(e.message))
            .finally(()=>setLoading(false));
    },[]);

    const set = (k:keyof SimParams) => (v:number) => setParams(p=>({...p,[k]:v}));

    const dotStyle = (c:string):React.CSSProperties=>({width:6,height:6,borderRadius:"50%",background:c,display:"inline-block"});
    const badgeStyle = (ok:boolean):React.CSSProperties=>({
        fontFamily:"monospace",fontSize:10,padding:"3px 10px",borderRadius:20,
        textTransform:"uppercase",letterSpacing:"0.08em",
        background:ok?"rgba(0,212,170,0.12)":"rgba(255,77,106,0.12)",
        color:ok?"#00d4aa":"#ff4d6a",
        border:`1px solid ${ok?"rgba(0,212,170,0.3)":"rgba(255,77,106,0.3)"}`,
    });

    const S: Record<string,React.CSSProperties> = {
        root:{minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"20px 24px"},
        header:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.08)"},
        title:{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"},
        panel:{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:16},
        kpiRow:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:12},
        grid:{display:"grid",gridTemplateColumns:"280px 1fr",gap:14},
        divider:{height:1,background:"rgba(255,255,255,0.07)",margin:"12px 0"},
        select:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#e8f4f1",borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:"monospace"},
    };

    if (loading) return (
        <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:"monospace",color:"#00d4aa",fontSize:13}}>LOADING FORECAST DATA...</div>
        </div>
    );

    if (error||!allForecast) return (
        <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{color:"#ff4d6a",fontFamily:"monospace",textAlign:"center"}}>
                {error||"No forecast data"}<br/>
                <span style={{fontSize:10,color:"rgba(232,244,241,0.4)"}}>Is the backend running? cd app && uvicorn main:app --reload</span>
            </div>
        </div>
    );

    const regionForecast  = allForecast.regions[selectedRegion];
    const regionInfo      = REGIONS.find(r=>r.col===selectedRegion)!;
    const forecast        = regionForecast?.forecast ?? [];
    const simHours        = forecast.length > 0 ? runSimulation(forecast, params) : [];
    const costs           = calcCosts(simHours);

    const peakOriginal    = Math.max(...simHours.map(h=>h.original), 0);
    const peakFinal       = Math.max(...simHours.map(h=>h.final), 0);
    const peakCap         = simHours.find(h=>h.original===peakOriginal)?.dynamicCap ?? 0;
    const overloadHours   = simHours.filter(h=>h.overCapacity).length;
    const totalEv         = simHours.reduce((s,h)=>s+h.ev_shifted,0);
    const totalAgri       = simHours.reduce((s,h)=>s+h.agri_shifted,0);
    const totalInd        = simHours.reduce((s,h)=>s+h.industrial_cut,0);
    const totalBackup     = simHours.reduce((s,h)=>s+h.backup_added,0);

    const chartData = simHours.map(h=>({
        label:             h.label,
        "Original":        h.original,
        "Adjusted":        h.final,
        "Dynamic Capacity":h.dynamicCap,
        "Solar":           h.solar_mw,
        "Wind":            h.wind_mw,
        "Hydro":           h.hydro_mw,
    }));

    const savingsData = simHours.map(h=>({
        label:         h.label,
        "EV Delay":    h.ev_shifted,
        "Agri Shift":  h.agri_shifted,
        "Ind. Cut":    h.industrial_cut,
        "Res. Flex":   h.residential_flex,
        "Backup":      h.backup_added,
    }));

    const costBreakdown = [
        {name:"Backup Gen",    value:costs.backupCost,  fill:"#ff4d6a"},
        {name:"EV Incentive",  value:costs.evCost,      fill:"#4da6ff"},
        {name:"Agri Incentive",value:costs.agriCost,    fill:"#c084fc"},
        {name:"Ind. Savings",  value:-costs.indSaving,  fill:"#00d4aa"},
    ];

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={S.header}>
                <div>
                    <div style={S.title}>⚡ Demand Response Simulator — India POSOCO</div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:3,fontFamily:"monospace"}}>
                        Adjust sliders · real-time impact on demand curve · dynamic capacity · cost · carbon
                    </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <NavLink href="/" label="Dashboard" />
                    <NavLink href="/capacity" label="Capacity" />
                    <NavLink href="/simulation" label="Simulator" active />
                    <NavLink href="/insights" label="ML Insights" />
                    <NavLink href="/history" label="History" />
                    <span style={badgeStyle(overloadHours===0)}>
            {overloadHours===0?"✓ Grid Stable":`⚠ ${overloadHours}h Overloaded`}
          </span>
                </div>
            </div>

            {/* Region selector */}
            <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"rgba(232,244,241,0.5)"}}>Region:</span>
                {REGIONS.map(r=>(
                    <button key={r.col} onClick={()=>setRegion(r.col)} style={{
                        background:selectedRegion===r.col?`${r.color}18`:"transparent",
                        border:`1px solid ${selectedRegion===r.col?r.color+"60":"rgba(255,255,255,0.1)"}`,
                        color:selectedRegion===r.col?r.color:"rgba(232,244,241,0.5)",
                        borderRadius:6,padding:"4px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer",
                    }}>{r.label}</button>
                ))}
                <span style={{marginLeft:"auto",fontSize:10,color:"rgba(232,244,241,0.4)",fontFamily:"monospace"}}>
          Installed: {(regionInfo.capacity/1000).toFixed(0)} GW · Peak dynamic cap: {(peakCap/1000).toFixed(1)} GW
        </span>
            </div>

            {/* Summary KPIs */}
            <div style={S.kpiRow}>
                <KPICard label="Peak Original"  value={`${(peakOriginal/1000).toFixed(1)} GW`} color="#ff4d6a" sub="Before interventions" />
                <KPICard label="Peak Adjusted"  value={`${(peakFinal/1000).toFixed(1)} GW`}   color={peakFinal<=peakCap?"#00d4aa":"#ffb347"} sub="After interventions" />
                <KPICard label="Net Cost (₹)"   value={`${costs.netCost<0?"−":""}₹${Math.abs(costs.netCost).toLocaleString()}`} color={costs.netCost<0?"#00d4aa":"#ffb347"} sub={costs.netCost<0?"Net savings":"Net expense"} />
                <KPICard label="Net CO₂ (t)"    value={`${costs.netCo2<0?"−":"+"}${Math.abs(Math.round(costs.netCo2/1000))}t`} color={costs.netCo2<0?"#00d4aa":"#ff4d6a"} sub={costs.netCo2<0?"Emissions avoided":"Extra emissions"} />
            </div>

            <div style={S.kpiRow}>
                <KPICard label="EV Load Shifted"   value={totalEv.toLocaleString()} color="#00d4aa" sub={`+${params.evDelayHours}h delay`} />
                <KPICard label="Agri Pump Deferred" value={totalAgri.toLocaleString()} color="#c084fc" sub={`${params.agriShiftPct}% shifted`} />
                <KPICard label="Industrial Cut"    value={totalInd.toLocaleString()} color="#ffb347" sub={`${params.industrialCutPct}% curtailed`} />
                <KPICard label="Overload Hours"    value={overloadHours} color={overloadHours===0?"#00d4aa":"#ff4d6a"} sub={overloadHours===0?"All safe":"Still at risk"} />
            </div>

            {/* Main layout */}
            <div style={S.grid}>
                {/* Controls */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#4da6ff")} /> EV Charging
                        </div>
                        <Slider label="Shift Delay" value={params.evDelayHours} min={1} max={6} unit="h" color="#4da6ff" onChange={set("evDelayHours")} description="hours to delay" />
                        <Slider label="Participation" value={params.evShiftPct} min={0} max={100} unit="%" color="#4da6ff" onChange={set("evShiftPct")} description="% EVs shifted" />
                    </div>

                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#c084fc")} /> Agricultural Load
                        </div>
                        <Slider label="Pump Deferral" value={params.agriShiftPct} min={0} max={30} unit="%" color="#c084fc" onChange={set("agriShiftPct")} description="% irrigation pumps" />
                    </div>

                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#ffb347")} /> Industrial Load
                        </div>
                        <Slider label="Curtailment" value={params.industrialCutPct} min={0} max={40} unit="%" color="#ffb347" onChange={set("industrialCutPct")} description="% reduction (DSM)" />
                    </div>

                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#00d4aa")} /> Residential Flex
                        </div>
                        <Slider label="Opt-in Rate" value={params.residentialFlexPct} min={0} max={20} unit="%" color="#00d4aa" onChange={set("residentialFlexPct")} description="% households" />
                    </div>

                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#ff4d6a")} /> Backup Generation
                        </div>
                        <Slider label="Available" value={params.backupSupplyMw} min={0} max={5000} step={100} unit=" MW" color="#ff4d6a" onChange={set("backupSupplyMw")} description="peaker + DG sets" />
                    </div>

                    {/* Cost panel */}
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Cost Breakdown (₹)</div>
                        {[
                            {label:"Backup gen cost",    value:costs.backupCost,  color:"#ff4d6a", positive:true},
                            {label:"EV incentive",       value:costs.evCost,      color:"#4da6ff", positive:true},
                            {label:"Agri incentive",     value:costs.agriCost,    color:"#c084fc", positive:true},
                            {label:"Industrial savings", value:-costs.indSaving,  color:"#00d4aa", positive:false},
                        ].map(row=>(
                            <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:11}}>
                                <span style={{color:"rgba(232,244,241,0.55)"}}>{row.label}</span>
                                <span style={{fontFamily:"monospace",color:row.color}}>
                  {row.positive?"+":""}{row.value<0?"−":""}₹{Math.abs(row.value).toLocaleString()}
                </span>
                            </div>
                        ))}
                        <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,marginTop:4}}>
                            <span style={{fontSize:12,fontWeight:500,color:"#e8f4f1"}}>Net</span>
                            <span style={{fontFamily:"monospace",fontSize:14,color:costs.netCost<0?"#00d4aa":"#ffb347",fontWeight:500}}>
                {costs.netCost<0?"−":"+"}₹{Math.abs(costs.netCost).toLocaleString()}
              </span>
                        </div>
                        <ResponsiveContainer width="100%" height={70}>
                            <BarChart data={costBreakdown} margin={{top:8,right:0,left:-24,bottom:0}}>
                                <XAxis dataKey="name" tick={{fill:"rgba(232,244,241,0.35)",fontSize:8}} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip formatter={(v:any)=>[`₹${Math.abs(v).toLocaleString()}`,""]} contentStyle={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.2)",fontSize:10}} />
                                <Bar dataKey="value" radius={[3,3,0,0]}>
                                    {costBreakdown.map((e,i)=><Cell key={i} fill={e.fill} fillOpacity={0.8} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Carbon panel */}
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Carbon Impact</div>
                        {[
                            {label:"CO₂ from backup",   value:Math.round(costs.co2Backup/1000), unit:"t",  color:"#ff4d6a", barPct:Math.min((costs.co2Backup/5000)*100,100)},
                            {label:"CO₂ avoided",       value:Math.round(costs.co2Avoided/1000),unit:"t",  color:"#00d4aa", barPct:Math.min((costs.co2Avoided/5000)*100,100)},
                        ].map(row=>(
                            <div key={row.label} style={{marginBottom:8}}>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                                    <span style={{color:"rgba(232,244,241,0.5)"}}>{row.label}</span>
                                    <span style={{fontFamily:"monospace",color:row.color}}>{row.value} {row.unit}</span>
                                </div>
                                <div style={{height:5,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${row.barPct}%`,background:row.color,borderRadius:3,transition:"width 0.4s"}} />
                                </div>
                            </div>
                        ))}
                        <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)",marginTop:4}}>
                            <span style={{fontSize:11,color:"#e8f4f1"}}>Net CO₂</span>
                            <span style={{fontFamily:"monospace",fontSize:13,color:costs.netCo2<0?"#00d4aa":"#ff4d6a"}}>
                {costs.netCo2<0?"−":"+"}  {Math.abs(Math.round(costs.netCo2/1000))} t
              </span>
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>

                    {/* Main demand vs dynamic capacity chart */}
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle(regionInfo.color)} /> 24h Demand vs Dynamic Capacity — {regionInfo.label}
                        </div>
                        <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap"}}>
                            {[
                                {color:"#ff4d6a",    label:"Original demand"},
                                {color:"#00d4aa",    label:"Adjusted demand"},
                                {color:"rgba(255,77,106,0.5)",label:"Dynamic capacity (varies hourly)"},
                            ].map(l=>(
                                <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(232,244,241,0.5)"}}>
                                    <div style={{width:14,height:2,background:l.color}} />{l.label}
                                </div>
                            ))}
                        </div>
                        <ResponsiveContainer width="100%" height={230}>
                            <ComposedChart data={chartData} margin={{top:4,right:12,left:0,bottom:0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={{stroke:"rgba(255,255,255,0.08)"}} tickLine={false} interval={3} />
                                <YAxis tickFormatter={(v:number)=>`${(v/1000).toFixed(0)}K`} tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} width={38} />
                                <Tooltip content={<Tip />} />
                                <Area  type="monotone" dataKey="Original"         stroke="#ff4d6a" fill="rgba(255,77,106,0.07)" strokeWidth={2} dot={false} />
                                <Line  type="monotone" dataKey="Adjusted"         stroke="#00d4aa" strokeWidth={2.5} dot={false} />
                                <Line  type="monotone" dataKey="Dynamic Capacity" stroke="rgba(255,77,106,0.55)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.35)",marginTop:6}}>
                            Dynamic capacity line reflects real solar availability (drops at night), wind (peaks in monsoon), hydro (peaks post-monsoon), and thermal PLF.
                        </div>
                    </div>

                    {/* Renewable availability chart */}
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#ffd60a")} /> Renewable Generation Availability — Hourly
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                            <ComposedChart data={chartData} margin={{top:4,right:12,left:0,bottom:0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} interval={3} />
                                <YAxis tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} width={38} />
                                <Tooltip content={<Tip />} />
                                <Area type="monotone" dataKey="Solar" stroke="#ffd60a" fill="rgba(255,214,10,0.2)"  strokeWidth={1.5} dot={false} stackId="re" />
                                <Area type="monotone" dataKey="Wind"  stroke="#4da6ff" fill="rgba(77,166,255,0.2)"  strokeWidth={1.5} dot={false} stackId="re" />
                                <Area type="monotone" dataKey="Hydro" stroke="#00d4aa" fill="rgba(0,212,170,0.2)"   strokeWidth={1.5} dot={false} stackId="re" />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{display:"flex",gap:12,marginTop:6}}>
                            {[{color:"#ffd60a",label:"Solar (zero at night)"},{color:"#4da6ff",label:"Wind (monsoon peak)"},{color:"#00d4aa",label:"Hydro (post-monsoon peak)"}].map(l=>(
                                <div key={l.label} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"rgba(232,244,241,0.45)"}}>
                                    <div style={{width:8,height:8,borderRadius:2,background:l.color}} />{l.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Savings breakdown */}
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                            <span style={dotStyle("#4da6ff")} /> Hourly Savings by Intervention
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                            <ComposedChart data={savingsData} margin={{top:4,right:12,left:0,bottom:0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} interval={3} />
                                <YAxis tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} width={38} />
                                <Tooltip content={<Tip />} />
                                <Area type="monotone" dataKey="EV Delay"   stroke="#4da6ff" fill="rgba(77,166,255,0.2)"  strokeWidth={1} dot={false} stackId="1" />
                                <Area type="monotone" dataKey="Agri Shift" stroke="#c084fc" fill="rgba(192,132,252,0.2)" strokeWidth={1} dot={false} stackId="1" />
                                <Area type="monotone" dataKey="Ind. Cut"   stroke="#ffb347" fill="rgba(255,179,71,0.2)"  strokeWidth={1} dot={false} stackId="1" />
                                <Area type="monotone" dataKey="Res. Flex"  stroke="#00d4aa" fill="rgba(0,212,170,0.2)"   strokeWidth={1} dot={false} stackId="1" />
                                <Area type="monotone" dataKey="Backup"     stroke="#ff4d6a" fill="rgba(255,77,106,0.2)"  strokeWidth={1} dot={false} stackId="1" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Hourly status strip */}
                    <div style={S.panel}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>
                            Hourly Grid Status After Interventions
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(24,minmax(0,1fr))",gap:3}}>
                            {simHours.map((h,i)=>{
                                const ratio = h.dynamicCap>0 ? Math.min(h.final/h.dynamicCap,1) : 0;
                                return (
                                    <div key={i} title={`${h.label}: ${(h.final/1000).toFixed(1)} GW / ${(h.dynamicCap/1000).toFixed(1)} GW cap`}
                                         style={{
                                             height:44,borderRadius:3,
                                             background:h.overCapacity?"rgba(255,77,106,0.7)":`rgba(${regionInfo.color==="#4da6ff"?"77,166,255":"0,212,170"},${0.15+ratio*0.65})`,
                                             border:h.overCapacity?"1px solid rgba(255,77,106,0.8)":"1px solid transparent",
                                             display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",
                                             paddingBottom:3,cursor:"default",
                                         }}>
                                        <span style={{fontFamily:"monospace",fontSize:7,color:h.overCapacity?"#ff4d6a":"rgba(232,244,241,0.5)"}}>{i}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{display:"flex",gap:16,marginTop:8,fontSize:10,color:"rgba(232,244,241,0.4)"}}>
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:10,borderRadius:2,background:"rgba(0,212,170,0.6)",display:"inline-block"}} /> Safe (vs dynamic cap)
              </span>
                            <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:10,borderRadius:2,background:"rgba(255,77,106,0.7)",display:"inline-block"}} /> Over capacity
              </span>
                            <span style={{marginLeft:"auto",fontFamily:"monospace"}}>Hover for MW values</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}