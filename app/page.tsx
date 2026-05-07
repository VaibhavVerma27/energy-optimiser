"use client";

import { useEffect, useState } from "react";
import {
    fetchDashboardData, fetchForecastStatus,
    type AllRegionsForecast, type AllRegionsCapacity,
    type ForecastStatus, type RegionResult,
    type CustomForecastInput,
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
    const [isCustomMode, setCustomMode] = useState(false);
    const [customPanelOpen, setCustomPanel] = useState(false);
    const [forecastDate, setForecastDate]   = useState(() => {
        const d = new Date(); d.setHours(d.getHours()+1,0,0,0);
        return d.toISOString().slice(0,16);
    });
    // Per-region raw text input (user pastes comma-separated MW values)
    const [customInputs, setCustomInputs] = useState<Record<string,string>>({});
    const [inputErrors, setInputErrors]   = useState<Record<string,string>>({});

    // New: structured inputs replacing raw paste
    const [activeTab, setActiveTab]       = useState<"quick"|"weather"|"holidays"|"advanced">("quick");
    const [quickInputs, setQuickInputs]   = useState<Record<string,string>>({
        Northern_Region_mw:"", Western_Region_mw:"", Eastern_Region_mw:"",
        Southern_Region_mw:"", NorthEastern_Region_mw:"",
    });
    // Weather overrides (per-region temperature slider + season select)
    const [weatherInputs, setWeatherInputs] = useState<Record<string,{temp:number,humidity:number,season:string}>>({
        Northern_Region_mw:{temp:32,humidity:55,season:"auto"},
        Western_Region_mw: {temp:30,humidity:70,season:"auto"},
        Eastern_Region_mw: {temp:31,humidity:72,season:"auto"},
        Southern_Region_mw:{temp:29,humidity:75,season:"auto"},
        NorthEastern_Region_mw:{temp:26,humidity:80,season:"auto"},
    });
    // Holiday overrides
    const [holidayInputs, setHolidayInputs] = useState({
        is_national_holiday: false,
        is_major_festival:   false,
        is_diwali_window:    false,
        is_pre_festival:     false,
    });

    const parseRegionInput = (raw: string): number[] | null => {
        const vals = raw.split(/[\s,\n\r]+/).map(s=>s.trim()).filter(Boolean).map(Number);
        if (vals.some(isNaN) || vals.length < 168) return null;
        return vals.slice(0, 168);
    };

    const load = async (customInput?: CustomForecastInput) => {
        try {
            setLoading(true);
            setError(null);
            const st = await fetchForecastStatus().catch(()=>null);
            setStatus(st);
            if (st?.all_models_ready) {
                const {forecast, capacity} = await fetchDashboardData(customInput);
                setForecast(forecast);
                setCap(capacity);
                setLastRefresh(new Date().toLocaleTimeString() + (customInput ? " (custom)" : ""));
            }
        } catch(e:any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Generate synthetic 168-hour demand history from a single representative value
    // Uses a daily pattern scaled to the user's entered peak + weather adjustments
    const generateHistory = (peakMw: number, region: string, wx: {temp:number,humidity:number}): number[] => {
        // India hourly load shape (% of daily peak, 24h pattern)
        const shape = [0.72,0.68,0.65,0.63,0.64,0.68,0.76,0.87,0.94,0.97,0.98,0.99,
            1.00,0.99,0.98,0.97,0.96,0.95,0.98,0.99,0.97,0.92,0.85,0.78];
        // Temperature adjustment: +0.8% per °C above 30°C (AC load effect)
        const tempAdj = 1 + Math.max(0, wx.temp - 30) * 0.008;
        // Humidity boost above 70%
        const humAdj  = 1 + Math.max(0, wx.humidity - 70) * 0.003;
        const history: number[] = [];
        for (let day = 0; day < 7; day++) {
            for (let h = 0; h < 24; h++) {
                // Slight weekday/weekend variation
                const wkFactor = (day === 0 || day === 6) ? 0.88 : 1.0;
                // Small random noise ±2% for realism
                const noise = 1 + (Math.sin(day * 37 + h * 13) * 0.02);
                const val = peakMw * shape[h] * wkFactor * tempAdj * humAdj * noise;
                history.push(Math.round(val));
            }
        }
        return history;
    };

    const runCustomForecast = () => {
        const errors: Record<string,string> = {};
        const input: CustomForecastInput = { start_datetime: new Date(forecastDate).toISOString() };
        let anyProvided = false;

        if (activeTab === "advanced") {
            // Raw paste mode — original behaviour
            REGIONS.forEach(r => {
                const raw = customInputs[r.col]?.trim();
                if (!raw) return;
                const vals = parseRegionInput(raw);
                if (!vals) {
                    errors[r.col] = `Need exactly 168 numeric values (got ${raw.split(/[\s,\n\r]+/).filter(Boolean).length})`;
                    return;
                }
                (input as any)[r.col] = vals;
                anyProvided = true;
            });
        } else {
            // Quick / Weather / Holiday tabs — generate history from structured inputs
            REGIONS.forEach(r => {
                const raw = quickInputs[r.col]?.trim();
                if (!raw) return;
                const peak = Number(raw);
                if (isNaN(peak) || peak <= 0) {
                    errors[r.col] = "Enter a valid MW value";
                    return;
                }
                const wx = weatherInputs[r.col] ?? {temp:30, humidity:60};
                const history = generateHistory(peak, r.col, wx);
                (input as any)[r.col] = history;
                anyProvided = true;
            });
        }

        setInputErrors(errors);
        if (Object.keys(errors).length > 0) return;
        if (!anyProvided) { setError("Enter at least one region's expected peak demand."); return; }
        setCustomMode(true);
        setCustomPanel(false);
        load(input);
    };

    const resetToAuto = () => {
        setCustomMode(false);
        setCustomInputs({});
        setInputErrors({});
        load();
    };

    useEffect(()=>{ load(); const iv=setInterval(()=>{ if(!isCustomMode) load(); },5*60*1000); return()=>clearInterval(iv); },[]);

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

            {/* ── Custom Input Panel ─────────────────────────────────────────────── */}
            <div style={{marginBottom:14}}>
                {/* Mode indicator bar */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:customPanelOpen?0:0}}>
                    <div style={{
                        display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:6,
                        background:isCustomMode?"rgba(255,179,71,0.1)":"rgba(0,212,170,0.06)",
                        border:`1px solid ${isCustomMode?"rgba(255,179,71,0.35)":"rgba(0,212,170,0.2)"}`,
                        fontSize:11,color:isCustomMode?"#ffb347":"#00d4aa",
                    }}>
                        <span>{isCustomMode?"📝 Custom forecast mode":"🔄 Auto mode — using last 7 days from dataset"}</span>
                        {isCustomMode && (
                            <button onClick={resetToAuto} style={{
                                marginLeft:8,background:"transparent",border:"1px solid rgba(255,179,71,0.4)",
                                color:"#ffb347",borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer",
                            }}>Reset to Auto</button>
                        )}
                    </div>
                    <button onClick={()=>setCustomPanel(p=>!p)} style={{
                        background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
                        color:"rgba(232,244,241,0.7)",borderRadius:6,padding:"6px 14px",
                        fontFamily:"monospace",fontSize:10,cursor:"pointer",
                        display:"flex",alignItems:"center",gap:6,
                    }}>
                        {customPanelOpen?"▲ Hide":"▼ Enter Custom Historical Data"}
                    </button>
                </div>

                {/* Collapsible panel */}
                {customPanelOpen && (
                    <div style={{marginTop:10,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,179,71,0.25)",borderRadius:10,padding:18}}>

                        {/* Header + date picker */}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
                            <div>
                                <div style={{fontSize:13,fontWeight:500,color:"#ffb347"}}>Custom Forecast</div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",marginTop:2}}>
                                    Enter today's expected conditions — the model generates 7 days of synthetic history automatically
                                </div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:11,color:"rgba(232,244,241,0.5)"}}>Forecast from:</span>
                                <input type="datetime-local" value={forecastDate}
                                       onChange={e=>setForecastDate(e.target.value)}
                                       style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",
                                           color:"#e8f4f1",borderRadius:6,padding:"5px 10px",fontFamily:"monospace",fontSize:11}} />
                            </div>
                        </div>

                        {/* Tabs */}
                        <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,0.07)",paddingBottom:0}}>
                            {([
                                {id:"quick",    label:"⚡ Quick Setup",   desc:"Enter peak demand per region"},
                                {id:"weather",  label:"🌡 Weather",       desc:"Temperature & humidity"},
                                {id:"holidays", label:"🎉 Holidays",      desc:"Festival & holiday flags"},
                                {id:"advanced", label:"🔧 Advanced",      desc:"Paste raw 168h values"},
                            ] as const).map(tab=>(
                                <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
                                    padding:"7px 14px",borderRadius:"6px 6px 0 0",fontSize:11,cursor:"pointer",
                                    fontFamily:"monospace",border:"none",outline:"none",
                                    background:activeTab===tab.id?"rgba(255,179,71,0.15)":"transparent",
                                    color:activeTab===tab.id?"#ffb347":"rgba(232,244,241,0.4)",
                                    borderBottom:activeTab===tab.id?"2px solid #ffb347":"2px solid transparent",
                                }}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* ── TAB: QUICK SETUP ── */}
                        {activeTab==="quick" && (
                            <div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",marginBottom:12,lineHeight:1.6}}>
                                    Enter the <strong style={{color:"#ffb347"}}>expected peak demand</strong> for today in each region (in MW).
                                    Leave blank to use the last 7 days from the dataset automatically.
                                    The model will build a realistic 7-day history around your peak value.
                                </div>
                                <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12}}>
                                    {REGIONS.map(r=>{
                                        const ranges: Record<string,[number,number]> = {
                                            Northern_Region_mw:[45000,92000], Western_Region_mw:[55000,105000],
                                            Eastern_Region_mw:[22000,48000],  Southern_Region_mw:[38000,78000],
                                            NorthEastern_Region_mw:[1200,3800],
                                        };
                                        const [lo,hi] = ranges[r.col] ?? [1000,130000];
                                        const val = quickInputs[r.col];
                                        const num = Number(val);
                                        const pct = val && !isNaN(num) ? Math.round(((num-lo)/(hi-lo))*100) : 0;
                                        const utilColor = pct>90?"#ff4d6a":pct>75?"#ffb347":r.color;
                                        return (
                                            <div key={r.col}>
                                                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                                                    <div style={{width:8,height:8,borderRadius:2,background:r.color}} />
                                                    <span style={{fontSize:11,fontWeight:500,color:r.color}}>{r.label}</span>
                                                </div>
                                                <div style={{position:"relative"}}>
                                                    <input type="number" min={lo} max={hi} step={100}
                                                           placeholder={`e.g. ${Math.round((lo+hi)/2/1000)*1000}`}
                                                           value={quickInputs[r.col]}
                                                           onChange={e=>setQuickInputs(p=>({...p,[r.col]:e.target.value}))}
                                                           style={{
                                                               width:"100%",boxSizing:"border-box",
                                                               background:"rgba(255,255,255,0.05)",
                                                               border:`1px solid ${inputErrors[r.col]?"rgba(255,77,106,0.6)":val?"rgba(255,179,71,0.4)":"rgba(255,255,255,0.1)"}`,
                                                               color:"#e8f4f1",borderRadius:6,padding:"8px 10px",
                                                               fontFamily:"monospace",fontSize:12,outline:"none",
                                                           }} />
                                                </div>
                                                {val && !isNaN(num) && (
                                                    <>
                                                        <div style={{height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,marginTop:5,overflow:"hidden"}}>
                                                            <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:utilColor,transition:"width 0.3s"}} />
                                                        </div>
                                                        <div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:9,fontFamily:"monospace"}}>
                                                            <span style={{color:"rgba(232,244,241,0.35)"}}>{(lo/1000).toFixed(0)}K</span>
                                                            <span style={{color:utilColor}}>{(num/1000).toFixed(1)} GW ({pct}%)</span>
                                                            <span style={{color:"rgba(232,244,241,0.35)"}}>{(hi/1000).toFixed(0)}K</span>
                                                        </div>
                                                    </>
                                                )}
                                                {inputErrors[r.col] && <div style={{fontSize:9,marginTop:3,color:"#ff4d6a"}}>{inputErrors[r.col]}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── TAB: WEATHER ── */}
                        {activeTab==="weather" && (
                            <div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",marginBottom:14,lineHeight:1.6}}>
                                    Set today's temperature and humidity per region. These directly affect AC load
                                    (each °C above 30°C adds ~0.8% to demand) and the model's weather features.
                                    Only relevant if you also entered peak demand in Quick Setup.
                                </div>
                                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                                    {REGIONS.map(r=>{
                                        const wx = weatherInputs[r.col];
                                        const tempColor = wx.temp>40?"#ff4d6a":wx.temp>35?"#ffb347":"#00d4aa";
                                        return (
                                            <div key={r.col} style={{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"12px 14px",
                                                border:`1px solid rgba(255,255,255,0.06)`}}>
                                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                                                    <div style={{width:8,height:8,borderRadius:2,background:r.color}} />
                                                    <span style={{fontSize:12,fontWeight:500,color:r.color}}>{r.label} Region</span>
                                                </div>
                                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                                                    {/* Temperature */}
                                                    <div>
                                                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                                                            <span style={{fontSize:11,color:"rgba(232,244,241,0.6)"}}>🌡 Temperature</span>
                                                            <span style={{fontFamily:"monospace",fontSize:11,color:tempColor,fontWeight:500}}>{wx.temp}°C</span>
                                                        </div>
                                                        <input type="range" min={10} max={48} step={1} value={wx.temp}
                                                               onChange={e=>setWeatherInputs(p=>({...p,[r.col]:{...p[r.col],temp:Number(e.target.value)}}))}
                                                               style={{width:"100%",accentColor:tempColor}} />
                                                        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(232,244,241,0.35)"}}>
                                                            <span>10°C</span>
                                                            <span style={{color:tempColor,fontSize:9}}>
                                {wx.temp>40?"Extreme heat":wx.temp>35?"Very hot":wx.temp>30?"Hot":wx.temp>24?"Warm":"Cool"}
                              </span>
                                                            <span>48°C</span>
                                                        </div>
                                                    </div>
                                                    {/* Humidity */}
                                                    <div>
                                                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                                                            <span style={{fontSize:11,color:"rgba(232,244,241,0.6)"}}>💧 Humidity</span>
                                                            <span style={{fontFamily:"monospace",fontSize:11,color:"#4da6ff",fontWeight:500}}>{wx.humidity}%</span>
                                                        </div>
                                                        <input type="range" min={10} max={98} step={1} value={wx.humidity}
                                                               onChange={e=>setWeatherInputs(p=>({...p,[r.col]:{...p[r.col],humidity:Number(e.target.value)}}))}
                                                               style={{width:"100%",accentColor:"#4da6ff"}} />
                                                        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(232,244,241,0.35)"}}>
                                                            <span>10%</span>
                                                            <span style={{color:"#4da6ff",fontSize:9}}>
                                {wx.humidity>85?"Monsoon":wx.humidity>70?"Humid":wx.humidity>50?"Moderate":"Dry"}
                              </span>
                                                            <span>98%</span>
                                                        </div>
                                                    </div>
                                                    {/* Heat index display */}
                                                    <div style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",
                                                        background:"rgba(255,255,255,0.03)",borderRadius:6,padding:"6px 10px"}}>
                                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginBottom:4}}>Feels like</div>
                                                        <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:tempColor}}>
                                                            {Math.round(wx.temp + Math.max(0,(wx.humidity-60)*0.08))}°C
                                                        </div>
                                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",marginTop:2}}>Heat index</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── TAB: HOLIDAYS ── */}
                        {activeTab==="holidays" && (
                            <div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",marginBottom:16,lineHeight:1.6}}>
                                    Override holiday detection for the forecast date. The model auto-detects
                                    Republic Day, Independence Day, Diwali etc. from the calendar — use these
                                    toggles only if you want to force a specific condition.
                                </div>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                                    {([
                                        {key:"is_national_holiday", label:"National Holiday", icon:"🇮🇳",
                                            desc:"Republic Day, Independence Day, Gandhi Jayanti — demand drops 10–15%",
                                            effect:"−10–15% demand"},
                                        {key:"is_major_festival",   label:"Major Festival",   icon:"🎆",
                                            desc:"Diwali, Holi, Eid, Durga Puja — factories close, residential up",
                                            effect:"−15–20% industrial"},
                                        {key:"is_diwali_window",    label:"Diwali Window",    icon:"🪔",
                                            desc:"Full 5-day Diwali festival — largest sustained demand drop of the year",
                                            effect:"−15–20% sustained"},
                                        {key:"is_pre_festival",     label:"Pre-Festival Day", icon:"🛍",
                                            desc:"3 days before Diwali or Eid — demand spikes from shopping and cooking",
                                            effect:"+5–8% spike"},
                                    ] as const).map(item=>{
                                        const active = holidayInputs[item.key];
                                        return (
                                            <div key={item.key} onClick={()=>setHolidayInputs(p=>({...p,[item.key]:!p[item.key]}))}
                                                 style={{
                                                     padding:"14px 16px",borderRadius:8,cursor:"pointer",transition:"all 0.2s",
                                                     background:active?"rgba(255,179,71,0.1)":"rgba(255,255,255,0.025)",
                                                     border:`1px solid ${active?"rgba(255,179,71,0.4)":"rgba(255,255,255,0.07)"}`,
                                                 }}>
                                                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                                                    <span style={{fontSize:20}}>{item.icon}</span>
                                                    <span style={{fontSize:12,fontWeight:500,color:active?"#ffb347":"#e8f4f1"}}>{item.label}</span>
                                                    <div style={{marginLeft:"auto",width:20,height:20,borderRadius:"50%",
                                                        background:active?"#ffb347":"rgba(255,255,255,0.1)",
                                                        border:`2px solid ${active?"#ffb347":"rgba(255,255,255,0.2)"}`,
                                                        display:"flex",alignItems:"center",justifyContent:"center",
                                                        fontSize:11,color:active?"#0a0f14":"transparent",flexShrink:0}}>✓</div>
                                                </div>
                                                <div style={{fontSize:10,color:"rgba(232,244,241,0.5)",lineHeight:1.5,marginBottom:5}}>{item.desc}</div>
                                                <div style={{fontSize:10,fontFamily:"monospace",
                                                    color:item.key==="is_pre_festival"?"#00d4aa":"#ff4d6a"}}>
                                                    Expected effect: {item.effect}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{marginTop:12,padding:"8px 12px",background:"rgba(0,212,170,0.04)",
                                    border:"1px solid rgba(0,212,170,0.15)",borderRadius:6,fontSize:10,color:"rgba(232,244,241,0.5)"}}>
                                    💡 The model auto-detects holidays from the forecast date you set above.
                                    These toggles <strong style={{color:"#00d4aa"}}>override</strong> that detection — useful for
                                    local festivals not in the national calendar (e.g. Pongal in Tamil Nadu, Durga Puja in West Bengal).
                                </div>
                            </div>
                        )}

                        {/* ── TAB: ADVANCED ── */}
                        {activeTab==="advanced" && (
                            <div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",marginBottom:12,lineHeight:1.6}}>
                                    Paste <strong style={{color:"#ffb347"}}>exactly 168 comma-separated MW values</strong> per region
                                    (7 days × 24 hours, oldest first). This gives the model real historical data
                                    instead of the synthetic history generated by Quick Setup.
                                    Leave blank to use the last 7 days from data/demand.csv.
                                </div>
                                <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10}}>
                                    {REGIONS.map(r=>{
                                        const cnt = customInputs[r.col] ? customInputs[r.col].split(/[\s,\n\r]+/).filter(Boolean).length : 0;
                                        return (
                                            <div key={r.col}>
                                                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                                                    <div style={{width:7,height:7,borderRadius:2,background:r.color}} />
                                                    <span style={{fontSize:11,color:r.color,fontWeight:500}}>{r.label}</span>
                                                    {cnt>0 && (
                                                        <span style={{marginLeft:"auto",fontSize:9,fontFamily:"monospace",
                                                            color:cnt>=168?"#00d4aa":"#ffb347"}}>
                              {cnt}/168 {cnt>=168?"✓":""}
                            </span>
                                                    )}
                                                </div>
                                                <textarea rows={5}
                                                          placeholder={`168 values, comma-separated\nOldest first\n(blank = auto)`}
                                                          value={customInputs[r.col]||""}
                                                          onChange={e=>setCustomInputs(p=>({...p,[r.col]:e.target.value}))}
                                                          style={{
                                                              width:"100%",boxSizing:"border-box",
                                                              background:"rgba(255,255,255,0.04)",
                                                              border:`1px solid ${inputErrors[r.col]?"rgba(255,77,106,0.5)":cnt>0?"rgba(255,179,71,0.35)":"rgba(255,255,255,0.1)"}`,
                                                              color:"#e8f4f1",borderRadius:6,padding:"7px 9px",
                                                              fontFamily:"monospace",fontSize:9,resize:"vertical",outline:"none",
                                                          }} />
                                                {inputErrors[r.col] && <div style={{fontSize:9,marginTop:2,color:"#ff4d6a"}}>{inputErrors[r.col]}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{marginTop:10,fontSize:10,color:"rgba(232,244,241,0.4)"}}>
                                    Typical ranges: Northern 45–92K MW · Western 55–105K MW ·
                                    Southern 38–78K MW · Eastern 22–48K MW · NE 1.2–3.8K MW
                                </div>
                            </div>
                        )}

                        {/* Footer: summary + run button */}
                        <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.07)",
                            display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            {/* Summary of what will be used */}
                            <div style={{flex:1,fontSize:10,color:"rgba(232,244,241,0.4)"}}>
                                {activeTab!=="advanced" && (
                                    <>
                                        {Object.values(quickInputs).filter(Boolean).length > 0
                                            ? <span style={{color:"#00d4aa"}}>✓ {Object.values(quickInputs).filter(Boolean).length} region{Object.values(quickInputs).filter(Boolean).length>1?"s":""} with custom peak</span>
                                            : <span>No regions filled — will use dataset history</span>
                                        }
                                        {Object.values(holidayInputs).some(Boolean) && (
                                            <span style={{marginLeft:10,color:"#ffb347"}}>
                        + {Object.entries(holidayInputs).filter(([,v])=>v).map(([k])=>k.replace("is_","").replace(/_/g," ")).join(", ")}
                      </span>
                                        )}
                                    </>
                                )}
                            </div>
                            <button onClick={runCustomForecast} disabled={loading} style={{
                                background:loading?"rgba(255,179,71,0.1)":"rgba(255,179,71,0.18)",
                                border:"1px solid rgba(255,179,71,0.5)",color:"#ffb347",
                                borderRadius:6,padding:"9px 22px",fontFamily:"monospace",
                                fontSize:11,cursor:loading?"not-allowed":"pointer",fontWeight:600,letterSpacing:"0.05em",
                            }}>
                                {loading?"Running…":"⚡ Run Forecast"}
                            </button>
                            <button onClick={()=>setCustomPanel(false)} style={{
                                background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                                color:"rgba(232,244,241,0.4)",borderRadius:6,padding:"9px 16px",
                                fontFamily:"monospace",fontSize:11,cursor:"pointer",
                            }}>Cancel</button>
                        </div>
                    </div>
                )}
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

            {/* ── Overload Alert Banner + DR Actions ───────────────────── */}
            {forecastData && totalOverload > 0 && (
                <div style={{marginBottom:14}}>
                    {/* Alert banner */}
                    <div style={{background:"rgba(255,77,106,0.08)",border:"1px solid rgba(255,77,106,0.3)",borderRadius:8,padding:"12px 16px",marginBottom:10,display:"flex",alignItems:"flex-start",gap:10}}>
                        <div style={{width:18,height:18,borderRadius:"50%",background:"#ff4d6a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,marginTop:1}}>!</div>
                        <div>
                            <div style={{fontSize:12,fontWeight:500,color:"#ff4d6a",marginBottom:4}}>
                                ⚠ Grid Overload Detected — {totalOverload} Region{totalOverload>1?"s":""} at Risk
                            </div>
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.65)",lineHeight:1.6}}>
                                {REGIONS.filter(r=>forecastData?.regions?.[r.col]?.overload_summary?.overload_detected).map(r=>{
                                    const os = forecastData.regions[r.col].overload_summary;
                                    return (
                                        <span key={r.col} style={{marginRight:16}}>
                      <span style={{color:r.color}}>{r.label}:</span>
                                            {" "}{os.total_overload_hours}h overloaded · peak {(os.peak_predicted_mw/1000).toFixed(1)} GW
                                            {os.excess_mw > 0 && <span style={{color:"#ff4d6a"}}> (+{(os.excess_mw/1000).toFixed(1)} GW excess)</span>}
                    </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* DR Actions summary across all overloaded regions */}
                    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:14}}>
                        <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>
                            Demand Response Actions — Active Recommendations
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                            {REGIONS.filter(r=>forecastData?.regions?.[r.col]?.overload_summary?.overload_detected).flatMap(r=>{
                                const actions = forecastData.regions[r.col].demand_response.actions;
                                return actions.map((a:any,i:number)=>(
                                    <div key={`${r.col}-${i}`} style={{
                                        background:a.impact_level==="high"?"rgba(255,77,106,0.07)":a.impact_level==="medium"?"rgba(255,179,71,0.06)":"rgba(0,212,170,0.05)",
                                        border:`1px solid ${a.impact_level==="high"?"rgba(255,77,106,0.25)":a.impact_level==="medium"?"rgba(255,179,71,0.2)":"rgba(0,212,170,0.2)"}`,
                                        borderRadius:6,padding:"9px 12px",borderLeft:`3px solid ${a.impact_level==="high"?"#ff4d6a":a.impact_level==="medium"?"#ffb347":"#00d4aa"}`,
                                    }}>
                                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                                            <span style={{fontSize:11,fontWeight:500,color:"#e8f4f1"}}>{a.name}</span>
                                            <span style={{fontFamily:"monospace",fontSize:10,color:r.color}}>{r.short}</span>
                                        </div>
                                        <div style={{fontSize:10,color:"rgba(232,244,241,0.5)",lineHeight:1.4,marginBottom:3}}>{a.description}</div>
                                        <div style={{fontFamily:"monospace",fontSize:10,color:a.type==="supply"?"#ff4d6a":"#00d4aa"}}>
                                            {a.type==="supply"?`+${a.reduction_mw.toLocaleString()} MW supply`:`−${a.reduction_mw.toLocaleString()} MW demand`}
                                            {a.cost_inr!==0&&<span style={{color:"rgba(232,244,241,0.35)",marginLeft:8}}>₹{Math.abs(a.cost_inr).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                ));
                            })}
                        </div>
                    </div>
                </div>
            )}

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