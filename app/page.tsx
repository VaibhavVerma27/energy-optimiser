"use client";

import { useEffect, useState } from "react";
import {
    fetchDashboardData, fetchForecastStatus,
    type AllRegionsForecast, type AllRegionsCapacity,
    type ForecastStatus, type RegionResult,
} from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { DemandChart } from "../components/DemandChart";
import { ActionPanel } from "../components/ActionPanel";

const REGIONS = [
    { col:"Northern_Region_mw",    id:"Northern_Region",    label:"Northern",      short:"NR",  capacity:115000, color:"#4da6ff", states:"UP · Delhi · Rajasthan · Punjab · Haryana · HP · J&K" },
    { col:"Western_Region_mw",     id:"Western_Region",     label:"Western",       short:"WR",  capacity:130000, color:"#ffb347", states:"Gujarat · Maharashtra · MP · Chhattisgarh · Goa" },
    { col:"Southern_Region_mw",    id:"Southern_Region",    label:"Southern",      short:"SR",  capacity:95000,  color:"#00d4aa", states:"AP · Telangana · Karnataka · Tamil Nadu · Kerala" },
    { col:"Eastern_Region_mw",     id:"Eastern_Region",     label:"Eastern",       short:"ER",  capacity:55000,  color:"#ff4d6a", states:"West Bengal · Odisha · Bihar · Jharkhand" },
    { col:"NorthEastern_Region_mw",id:"NorthEastern_Region",label:"North-Eastern", short:"NER", capacity:4500,   color:"#c084fc", states:"Assam · Meghalaya · Manipur · Mizoram · Nagaland" },
];

const PLANT_DATA: Record<string, {name:string;type:string;state:string;capacity:string}[]> = {
    Northern_Region_mw:[
        {name:"Rihand TPS",          type:"Thermal",state:"UP",          capacity:"3,000"},
        {name:"Tehri Dam HEP",       type:"Hydro",  state:"Uttarakhand", capacity:"2,400"},
        {name:"Singrauli Super TPS", type:"Thermal",state:"UP",          capacity:"2,000"},
        {name:"Nathpa Jhakri HEP",   type:"Hydro",  state:"HP",          capacity:"1,530"},
        {name:"Rajasthan Solar Park",type:"Solar",  state:"Rajasthan",   capacity:"2,245"},
        {name:"NTPC Dadri",          type:"Thermal",state:"UP",          capacity:"1,820"},
    ],
    Western_Region_mw:[
        {name:"Mundra UMPP",        type:"Thermal",state:"Gujarat",      capacity:"4,620"},
        {name:"Vindhyachal STPS",   type:"Thermal",state:"MP",           capacity:"4,760"},
        {name:"Bhadla Solar Park",  type:"Solar",  state:"Rajasthan",    capacity:"2,960"},
        {name:"Koyna HEP",          type:"Hydro",  state:"Maharashtra",  capacity:"1,960"},
        {name:"Tiroda TPS",         type:"Thermal",state:"Maharashtra",  capacity:"3,300"},
        {name:"Sardar Sarovar HEP", type:"Hydro",  state:"Gujarat",      capacity:"1,450"},
    ],
    Southern_Region_mw:[
        {name:"Ramagundam STPS",    type:"Thermal",state:"Telangana",    capacity:"2,600"},
        {name:"Kudankulam NPP",     type:"Nuclear",state:"Tamil Nadu",   capacity:"2,000"},
        {name:"Srisailam HEP",      type:"Hydro",  state:"AP",           capacity:"1,670"},
        {name:"Pavagada Solar Park",type:"Solar",  state:"Karnataka",    capacity:"2,050"},
        {name:"Muppandal Wind Farm",type:"Wind",   state:"Tamil Nadu",   capacity:"1,500"},
        {name:"Talcher STPS",       type:"Thermal",state:"Odisha",       capacity:"3,000"},
    ],
    Eastern_Region_mw:[
        {name:"Farakka STPS",       type:"Thermal",state:"West Bengal",  capacity:"2,100"},
        {name:"Kahalgaon STPS",     type:"Thermal",state:"Bihar",        capacity:"2,340"},
        {name:"Talcher STPS",       type:"Thermal",state:"Odisha",       capacity:"3,000"},
        {name:"DVC Chandrapura",    type:"Thermal",state:"Jharkhand",    capacity:"630"},
        {name:"Odisha Solar Parks", type:"Solar",  state:"Odisha",       capacity:"500"},
    ],
    NorthEastern_Region_mw:[
        {name:"Kopili HEP",         type:"Hydro",  state:"Assam",        capacity:"275"},
        {name:"Loktak HEP",         type:"Hydro",  state:"Manipur",      capacity:"105"},
        {name:"Umiam HEP",          type:"Hydro",  state:"Meghalaya",    capacity:"185"},
        {name:"Assam Gas TPS",      type:"Gas",    state:"Assam",        capacity:"291"},
        {name:"NE Solar Projects",  type:"Solar",  state:"Various",      capacity:"200"},
    ],
};

const SOURCE_COLORS: Record<string, string> = {
    thermal:"#ff6b35", solar:"#ffd60a", wind:"#4da6ff",
    hydro:"#00d4aa",   nuclear:"#c084fc", other:"#888",
};

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

function SetupBanner({status}:{status:ForecastStatus}) {
    const missing = Object.entries(status.models).filter(([,v])=>!v).map(([k])=>k);
    return (
        <div style={{background:"rgba(255,179,71,0.08)",border:"1px solid rgba(255,179,71,0.3)",borderRadius:8,padding:"14px 18px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:500,color:"#ffb347",marginBottom:8}}>⚠ Setup Required</div>
            {!status.data_file && (
                <div style={{fontSize:11,color:"rgba(232,244,241,0.7)",marginBottom:6}}>
                    <strong style={{color:"#ffb347"}}>1.</strong> Place xlsx in <code style={{background:"rgba(255,255,255,0.06)",padding:"1px 6px",borderRadius:3}}>app/data/</code> → <code style={{background:"rgba(255,255,255,0.06)",padding:"1px 6px",borderRadius:3}}>python prepare_dataset.py</code>
                </div>
            )}
            {status.data_file && missing.length>0 && (
                <div style={{fontSize:11,color:"rgba(232,244,241,0.7)"}}>
                    <strong style={{color:"#ffb347"}}>2.</strong> <code style={{background:"rgba(255,255,255,0.06)",padding:"1px 6px",borderRadius:3}}>python train.py --data data/demand.csv</code>
                    <div style={{marginTop:4,color:"rgba(232,244,241,0.45)",fontSize:10}}>Missing: {missing.join(", ")}</div>
                </div>
            )}
        </div>
    );
}

function CapacityBar({breakdown, total}:{breakdown:Record<string,number>; total:number}) {
    const sources = ["thermal","hydro","nuclear","wind","solar","other"] as const;
    return (
        <div style={{marginTop:8}}>
            <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",gap:1}}>
                {sources.map(src => {
                    const mw  = breakdown[src] ?? 0;
                    const pct = total > 0 ? (mw / total) * 100 : 0;
                    return pct > 0 ? (
                        <div key={src} title={`${src}: ${mw.toLocaleString()} MW`}
                             style={{width:`${pct}%`,background:SOURCE_COLORS[src],opacity:0.85}} />
                    ) : null;
                })}
            </div>
            <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
                {sources.map(src => {
                    const mw = breakdown[src] ?? 0;
                    return mw > 0 ? (
                        <span key={src} style={{fontSize:9,color:"rgba(232,244,241,0.45)",display:"flex",alignItems:"center",gap:3}}>
              <span style={{width:6,height:6,borderRadius:1,background:SOURCE_COLORS[src],display:"inline-block"}} />
                            {src} {(mw/1000).toFixed(0)}GW
            </span>
                    ) : null;
                })}
            </div>
        </div>
    );
}

function RegionCard({region,forecastData,capData,selected,onClick}:{
    region:typeof REGIONS[0];
    forecastData:RegionResult|undefined;
    capData:any;
    selected:boolean;
    onClick:()=>void;
}) {
    const forecast    = forecastData?.forecast ?? [];
    const peak        = forecastData?.overload_summary.peak_predicted_mw ?? 0;
    const overloaded  = forecastData?.overload_summary.overload_detected ?? false;
    const availableMw = capData?.total_available_mw ?? region.capacity;
    const utilPct     = peak > 0 ? Math.round((peak / availableMw) * 100) : 0;
    const vals        = forecast.map((h:any)=>h.predicted_demand_mw);
    const mn = vals.length ? Math.min(...vals) : 0;
    const mx = vals.length ? Math.max(...vals) : 1;

    return (
        <div onClick={onClick} style={{
            background:selected?`${region.color}12`:"rgba(255,255,255,0.025)",
            border:`1px solid ${selected?region.color+"60":"rgba(255,255,255,0.07)"}`,
            borderLeft:`3px solid ${region.color}`,
            borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all 0.2s",
        }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                    <div style={{fontFamily:"monospace",fontSize:9,color:region.color,letterSpacing:"0.1em",marginBottom:3}}>{region.short}</div>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8f4f1"}}>{region.label}</div>
                </div>
                <div style={{
                    fontSize:9,padding:"2px 7px",borderRadius:3,fontFamily:"monospace",
                    background:forecastData?(overloaded?"rgba(255,77,106,0.15)":"rgba(0,212,170,0.1)"):"rgba(255,255,255,0.05)",
                    color:forecastData?(overloaded?"#ff4d6a":"#00d4aa"):"rgba(232,244,241,0.3)",
                    border:`1px solid ${forecastData?(overloaded?"rgba(255,77,106,0.3)":"rgba(0,212,170,0.2)"):"rgba(255,255,255,0.1)"}`,
                }}>{forecastData?(overloaded?"⚠ RISK":"✓ OK"):"—"}</div>
            </div>

            <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",marginBottom:8,lineHeight:1.4}}>{region.states}</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                <div>
                    <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginBottom:2}}>Peak demand</div>
                    <div style={{fontFamily:"monospace",fontSize:15,color:overloaded?"#ff4d6a":region.color}}>
                        {peak>0?`${(peak/1000).toFixed(1)} GW`:"—"}
                    </div>
                </div>
                <div>
                    <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginBottom:2}}>Available now</div>
                    <div style={{fontFamily:"monospace",fontSize:15,color:"rgba(232,244,241,0.7)"}}>
                        {(availableMw/1000).toFixed(1)} GW
                    </div>
                </div>
            </div>

            {/* Dynamic utilisation bar */}
            <div style={{height:5,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden"}}>
                <div style={{
                    height:"100%",borderRadius:3,transition:"width 0.6s",
                    width:`${Math.min(utilPct,100)}%`,
                    background:utilPct>95?"#ff4d6a":utilPct>80?"#ffb347":region.color,
                }} />
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:9,color:"rgba(232,244,241,0.4)"}}>
                <span>vs available capacity</span>
                <span style={{fontFamily:"monospace",color:utilPct>95?"#ff4d6a":"rgba(232,244,241,0.6)"}}>{utilPct}%</span>
            </div>

            {/* Generation mix mini-bar */}
            {capData?.breakdown_mw && (
                <CapacityBar breakdown={capData.breakdown_mw} total={availableMw} />
            )}

            {/* Sparkline */}
            {vals.length > 0 && (
                <div style={{marginTop:8,display:"flex",alignItems:"flex-end",gap:1,height:22}}>
                    {forecast.map((h:any,i:number)=>{
                        const ht = mx>mn?Math.round(((h.predicted_demand_mw-mn)/(mx-mn))*22):11;
                        const cap_h = h.capacity_mw ?? availableMw;
                        return <div key={i} title={`${h.label}: ${(h.predicted_demand_mw/1000).toFixed(1)} GW`}
                                    style={{flex:1,height:Math.max(ht,2),background:h.predicted_demand_mw>cap_h?"#ff4d6a":region.color,opacity:0.6,borderRadius:1}} />;
                    })}
                </div>
            )}

            {/* Active alerts from capacity engine */}
            {capData?.alerts?.length > 0 && (
                <div style={{marginTop:6,fontSize:9,color:"#ffb347",lineHeight:1.4}}>{capData.alerts[0]}</div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const [forecastData, setForecast] = useState<AllRegionsForecast|null>(null);
    const [capData, setCap]           = useState<AllRegionsCapacity|null>(null);
    const [status, setStatus]         = useState<ForecastStatus|null>(null);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState<string|null>(null);
    const [selected, setSelected]     = useState<string|null>(null);
    const [lastRefresh, setLastRefresh] = useState("");

    const load = async () => {
        try {
            setLoading(true);
            setError(null);
            const st = await fetchForecastStatus().catch(()=>null);
            setStatus(st);
            if (st?.all_models_ready) {
                const {forecast, capacity} = await fetchDashboardData();
                setForecast(forecast);
                setCap(capacity);
                setLastRefresh(new Date().toLocaleTimeString());
            }
        } catch(e:any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(()=>{ load(); const iv=setInterval(load,5*60*1000); return()=>clearInterval(iv); },[]);

    const rootStyle: React.CSSProperties = {
        minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",
        fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"20px 24px",
    };

    if (loading && !forecastData && !status) return (
        <div style={{...rootStyle,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:"monospace",color:"#00d4aa",fontSize:13,letterSpacing:"0.1em"}}>CONNECTING TO INDIA GRID API...</div>
        </div>
    );

    const S: Record<string,React.CSSProperties> = {
        root:rootStyle,
        header:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.08)"},
        title:{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"},
        statsRow:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14},
        regionsGrid:{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginBottom:16},
        panel:{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:16},
        twoCol:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14},
        threeCol:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14},
    };

    const totalOverload  = REGIONS.filter(r=>forecastData?.regions?.[r.col]?.overload_summary?.overload_detected).length;
    const allIndiaPeak   = forecastData?.all_india?.peak_mw ?? 0;
    const allIndiaAvail  = capData?.all_india?.total_available_mw ?? 0;
    const allIndiaUtil   = allIndiaAvail > 0 ? Math.round((allIndiaPeak/allIndiaAvail)*100) : 0;
    const renewablePct   = capData?.all_india?.renewable_pct ?? 0;
    const allIndiaFc     = forecastData?.all_india?.forecast ?? [];
    const selectedR      = REGIONS.find(r=>r.col===selected);
    const selectedFc     = selected ? forecastData?.regions?.[selected] : undefined;
    const selectedCap    = selected ? capData?.regions?.[selectedR?.id ?? ""] : undefined;

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={S.header}>
                <div>
                    <div style={S.title}>⚡ India Smart Grid — POSOCO Load Forecast</div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:3,fontFamily:"monospace"}}>
                        5 Regional Grids · Dynamic Capacity · CEA 2023-24{lastRefresh&&` · Updated ${lastRefresh}`}
                    </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <NavLink href="/" label="Dashboard" active />
                    <NavLink href="/capacity" label="Capacity" />
                    <NavLink href="/simulation" label="Simulator" />
                    <NavLink href="/insights" label="ML Insights" />
                    <NavLink href="/history" label="History" />
                    {forecastData && (
                        <div style={{
                            fontFamily:"monospace",fontSize:10,padding:"3px 10px",borderRadius:20,
                            background:totalOverload>0?"rgba(255,77,106,0.12)":"rgba(0,212,170,0.1)",
                            color:totalOverload>0?"#ff4d6a":"#00d4aa",
                            border:`1px solid ${totalOverload>0?"rgba(255,77,106,0.3)":"rgba(0,212,170,0.2)"}`,
                        }}>
                            {totalOverload>0?`⚠ ${totalOverload} Region${totalOverload>1?"s":""} at Risk`:"✓ All Regions Stable"}
                        </div>
                    )}
                    <button onClick={load} style={{background:"transparent",border:"1px solid rgba(0,212,170,0.3)",color:"#00d4aa",borderRadius:6,padding:"4px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                        {loading?"…":"Refresh"}
                    </button>
                </div>
            </div>

            {status&&(!status.all_models_ready||!status.data_file)&&<SetupBanner status={status} />}
            {error&&(
                <div style={{background:"rgba(255,77,106,0.08)",border:"1px solid rgba(255,77,106,0.3)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:11,color:"#ff4d6a"}}>
                    {error} — is the backend running? <code>uvicorn main:app --reload</code>
                </div>
            )}

            {/* KPI row */}
            <div style={S.statsRow}>
                <MetricCard label="All-India Peak"    value={allIndiaPeak>0?`${(allIndiaPeak/1000).toFixed(0)} GW`:"—"}  sub="Sum of 5 regions"        accent="teal" />
                <MetricCard label="Available Now"     value={allIndiaAvail>0?`${(allIndiaAvail/1000).toFixed(0)} GW`:"—"} sub="Dynamic: solar+wind+hydro+thermal" accent="blue" />
                <MetricCard label="Grid Utilisation"  value={allIndiaUtil>0?`${allIndiaUtil}%`:"—"}                         sub="Peak demand / available"  accent={allIndiaUtil>90?"red":"teal"} />
                <MetricCard label="Renewable Share"   value={renewablePct>0?`${renewablePct}%`:"—"}                         sub="Of available capacity now" accent="teal" />
            </div>

            {/* All-India capacity breakdown */}
            {capData && (
                <div style={{...S.panel, marginBottom:14}}>
                    <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>
                        All-India Available Capacity — Current Hour Generation Mix
                    </div>
                    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:200}}>
                            <div style={{display:"flex",height:20,borderRadius:4,overflow:"hidden",gap:1}}>
                                {Object.entries(capData.all_india).filter(([k])=>k.endsWith("_mw") && k!=="installed_mw").map(([k,v])=>{
                                    const src = k.replace("_mw","");
                                    const pct = ((v as number) / capData.all_india.total_available_mw) * 100;
                                    return pct>0.5 ? (
                                        <div key={src} title={`${src}: ${((v as number)/1000).toFixed(0)} GW`}
                                             style={{width:`${pct}%`,background:(SOURCE_COLORS as any)[src]??"#888",opacity:0.85,
                                                 display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#0a0f14",fontWeight:700}}>
                                            {pct>8?src.slice(0,3).toUpperCase():""}
                                        </div>
                                    ):null;
                                })}
                            </div>
                        </div>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                            {[
                                {k:"thermal_mw",  label:"Thermal",  color:SOURCE_COLORS.thermal},
                                {k:"renewable_mw",label:"Renewable", color:SOURCE_COLORS.solar},
                            ].map(s=>{
                                const v = (capData.all_india as any)[s.k] ?? 0;
                                return (
                                    <div key={s.k} style={{display:"flex",alignItems:"center",gap:6}}>
                                        <div style={{width:8,height:8,borderRadius:2,background:s.color}} />
                                        <span style={{fontSize:11,color:"rgba(232,244,241,0.6)"}}>{s.label}</span>
                                        <span style={{fontFamily:"monospace",fontSize:11,color:s.color}}>{(v/1000).toFixed(0)} GW</span>
                                    </div>
                                );
                            })}
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.3)",fontFamily:"monospace"}}>
                                {capData.timestamp_ist}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Region cards */}
            <div style={S.regionsGrid}>
                {REGIONS.map(r=>(
                    <RegionCard key={r.col}
                                region={r}
                                forecastData={forecastData?.regions?.[r.col]}
                                capData={capData?.regions?.[r.id]}
                                selected={selected===r.col}
                                onClick={()=>setSelected(selected===r.col?null:r.col)}
                    />
                ))}
            </div>

            {/* Selected region detail */}
            {selectedR && selectedFc && (
                <div style={{marginBottom:16,background:"rgba(255,255,255,0.02)",border:`1px solid ${selectedR.color}30`,borderRadius:10,padding:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                        <div style={{width:3,height:20,background:selectedR.color,borderRadius:2}} />
                        <span style={{fontSize:14,fontWeight:500,color:"#e8f4f1"}}>{selectedR.label} Region — Detail</span>
                        <button onClick={()=>setSelected(null)} style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(232,244,241,0.4)",borderRadius:5,padding:"3px 10px",cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>Close ✕</button>
                    </div>

                    {/* 4 KPIs */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14}}>
                        {[
                            {label:"Peak Demand",    value:`${(selectedFc.overload_summary.peak_predicted_mw/1000).toFixed(1)} GW`, color:selectedFc.overload_summary.overload_detected?"#ff4d6a":selectedR.color, sub:`at ${selectedFc.overload_summary.peak_hour}`},
                            {label:"Available Now",  value:selectedCap?`${(selectedCap.total_available_mw/1000).toFixed(1)} GW`:"—", color:"rgba(232,244,241,0.7)", sub:"Dynamic capacity"},
                            {label:"Overload Hours", value:selectedFc.overload_summary.total_overload_hours, color:selectedFc.overload_summary.overload_detected?"#ff4d6a":"#00d4aa", sub:selectedFc.overload_summary.overload_detected?`${selectedFc.overload_summary.excess_mw.toLocaleString()} MW excess`:"All safe"},
                            {label:"DR Reduction",   value:`${(selectedFc.demand_response.total_reduction_mw/1000).toFixed(1)} GW`, color:"#00d4aa", sub:"Post-intervention"},
                        ].map(s=>(
                            <div key={s.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 12px",borderTop:`2px solid ${s.color}`}}>
                                <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{s.label}</div>
                                <div style={{fontFamily:"monospace",fontSize:18,color:s.color}}>{s.value}</div>
                                <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",marginTop:2}}>{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Capacity breakdown for region */}
                    {selectedCap && (
                        <div style={{...S.panel, marginBottom:14}}>
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>
                                Current Generation Mix — {selectedR.label} Region
                            </div>
                            <CapacityBar breakdown={selectedCap.breakdown_mw} total={selectedCap.total_available_mw} />
                            <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
                                {Object.entries(selectedCap.capacity_factors).map(([src,cf])=>(
                                    <div key={src} style={{fontSize:10,color:"rgba(232,244,241,0.5)"}}>
                                        <span style={{color:(SOURCE_COLORS as any)[src]??"#888"}}>{src}</span>
                                        <span style={{fontFamily:"monospace",marginLeft:4}}>{Math.round((cf as number)*100)}% CF</span>
                                    </div>
                                ))}
                            </div>
                            {selectedCap.alerts.length>0 && (
                                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
                                    {selectedCap.alerts.map((a,i)=>(
                                        <div key={i} style={{fontSize:10,padding:"5px 10px",borderRadius:5,
                                            background:a.includes("🔴")?"rgba(255,77,106,0.1)":a.includes("⚠")?"rgba(255,179,71,0.08)":"rgba(0,212,170,0.06)",
                                            color:a.includes("🔴")?"#ff4d6a":a.includes("⚠")?"#ffb347":"#00d4aa",
                                            border:`1px solid ${a.includes("🔴")?"rgba(255,77,106,0.25)":a.includes("⚠")?"rgba(255,179,71,0.2)":"rgba(0,212,170,0.15)"}`
                                        }}>{a}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={S.twoCol}>
                        <div style={S.panel}>
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>
                                24-Hour Forecast vs Dynamic Capacity
                            </div>
                            <DemandChart data={selectedFc.forecast} capacityMw={selectedCap?.total_available_mw ?? selectedR.capacity} />
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.35)",marginTop:6}}>
                                Red capacity line = dynamic available capacity (varies by hour)
                            </div>
                        </div>
                        <div style={S.panel}>
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Key Power Plants</div>
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {(PLANT_DATA[selectedR.col]??[]).map(p=>(
                                    <div key={p.name} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"rgba(255,255,255,0.03)",borderRadius:6,fontSize:11}}>
                                        <div>
                                            <div style={{color:"#e8f4f1",fontWeight:500}}>{p.name}</div>
                                            <div style={{color:"rgba(232,244,241,0.4)",fontSize:10}}>{p.type} · {p.state}</div>
                                        </div>
                                        <div style={{textAlign:"right"}}>
                                            <div style={{fontFamily:"monospace",color:selectedR.color}}>{p.capacity}</div>
                                            <div style={{fontSize:10,color:"rgba(232,244,241,0.35)"}}>MW</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {selectedFc.demand_response.actions.length>0 && (
                        <div style={{...S.panel,marginTop:14}}>
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Demand Response Actions</div>
                            <ActionPanel actions={selectedFc.demand_response.actions} />
                        </div>
                    )}
                </div>
            )}

            {/* All-India chart */}
            {allIndiaFc.length>0 && (
                <div style={S.panel}>
                    <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>
                        All-India 24h Aggregated Demand Forecast
                    </div>
                    <DemandChart data={allIndiaFc} capacityMw={allIndiaAvail||399500} />
                </div>
            )}

            {/* Capacity distribution bar */}
            <div style={{...S.panel,marginTop:14}}>
                <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>
                    Installed Capacity Distribution (CEA 2023-24)
                </div>
                <div style={{display:"flex",height:28,borderRadius:6,overflow:"hidden",marginBottom:10}}>
                    {REGIONS.map(r=>(
                        <div key={r.col} title={`${r.label}: ${(r.capacity/1000).toFixed(0)} GW installed`}
                             style={{flex:r.capacity,background:r.color,opacity:0.75,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontFamily:"monospace",color:"#0a0f14",fontWeight:700}}>
                            {r.short}
                        </div>
                    ))}
                </div>
                <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    {REGIONS.map(r=>{
                        const rc = capData?.regions?.[r.id];
                        return (
                            <div key={r.col} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                                <div style={{width:8,height:8,borderRadius:2,background:r.color}} />
                                <span style={{color:"rgba(232,244,241,0.6)"}}>{r.label}</span>
                                <span style={{fontFamily:"monospace",color:r.color}}>{(r.capacity/1000).toFixed(0)} GW</span>
                                {rc && (
                                    <span style={{fontFamily:"monospace",fontSize:10,color:"rgba(232,244,241,0.4)"}}>
                    · avail {(rc.total_available_mw/1000).toFixed(1)} GW
                  </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}