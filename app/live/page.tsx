"use client";

import { useState, useCallback, useEffect } from "react";
import {
    ResponsiveContainer, ComposedChart, Area, Line,
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot,
} from "recharts";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const REGIONS = [
    { id:"Northern_Region",     label:"Northern",  color:"#4da6ff", city:"New Delhi" },
    { id:"Western_Region",      label:"Western",   color:"#ffb347", city:"Mumbai" },
    { id:"Southern_Region",     label:"Southern",  color:"#00d4aa", city:"Chennai" },
    { id:"Eastern_Region",      label:"Eastern",   color:"#ff4d6a", city:"Kolkata" },
    { id:"NorthEastern_Region", label:"NE Region", color:"#c084fc", city:"Guwahati" },
];
const ALL_INDIA_TAB = { id:"ALL_INDIA", label:"All-India", color:"#e8f4f1", city:"National Grid" };
const ALL_TABS = [...REGIONS, ALL_INDIA_TAB];

const Tip = ({active,payload,label}:any) => {
    if (!active||!payload?.length) return null;
    return (
        <div style={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.25)",borderRadius:6,padding:"9px 13px",fontSize:11}}>
            <p style={{color:"#00d4aa",marginBottom:4,fontFamily:"monospace"}}>{label}</p>
            {payload.filter((p:any)=>!["ci_lower","ci_band"].includes(p.name)).map((p:any)=>(
                <p key={p.name} style={{color:p.color??p.stroke??"#e8f4f1",margin:"2px 0"}}>
                    {p.name}: <strong>{typeof p.value==="number"?`${p.value.toLocaleString()} MW`:p.value}</strong>
                </p>
            ))}
            {payload[0]?.payload?.temp_c!=null&&(
                <p style={{color:"#f59e0b",fontSize:10,marginTop:4}}>
                    🌡 {payload[0].payload.temp_c}°C · ☀ {payload[0].payload.solar_wm2} W/m²
                </p>
            )}
        </div>
    );
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBadge({n,label,active,done}:{n:number;label:string;active:boolean;done:boolean}) {
    const c = done ? "#00d4aa" : active ? "#f59e0b" : "rgba(232,244,241,0.2)";
    return (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${c}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:done?"rgba(0,212,170,0.12)":active?"rgba(245,158,11,0.1)":"transparent",
                fontFamily:"monospace",fontSize:11,fontWeight:700,color:c,flexShrink:0}}>
                {done?"✓":n}
            </div>
            <span style={{fontSize:11,color:done||active?"#e8f4f1":"rgba(232,244,241,0.3)",fontWeight:active?600:400}}>
        {label}
      </span>
        </div>
    );
}

export default function LivePage() {
    // ── Step state ──────────────────────────────────────────────────────────────
    const [step, setStep]               = useState<1|2|3>(1);

    // Step 1: mode + date
    const [mode, setMode]               = useState<"live"|"specific">("live");
    const [targetDate, setTargetDate]   = useState<string>(() => {
        const d = new Date(); d.setDate(d.getDate()+1);
        return d.toISOString().slice(0,10);
    });

    // Step 2: file upload
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploading, setUploading]     = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [meritReady, setMeritReady]   = useState(false);

    // Step 3: forecast result
    const [forecast, setForecast]       = useState<any>(null);
    const [weather, setWeather]         = useState<any>(null);
    const [loading, setLoading]         = useState(false);
    const [saveOk, setSaveOk]           = useState(false);
    const [selected, setSelected]       = useState("ALL_INDIA");

    // ── API calls ───────────────────────────────────────────────────────────────
    const fetchWeather = useCallback(async () => {
        try {
            const r = await fetch(`${BASE}/api/live/weather?hours_ahead=24`);
            const d = await r.json();
            setWeather(d.regions ?? null);
        } catch {}
    }, []);

    const uploadFiles = useCallback(async (files: File[]) => {
        if (!files.length) return;
        setUploading(true); setUploadResult(null);
        const form = new FormData();
        files.forEach(f => form.append("files", f));
        try {
            const r = await fetch(`${BASE}/api/upload/merit-demand`, { method:"POST", body:form });
            const d = await r.json();
            setUploadResult(d);
            if (d.status === "ok") setMeritReady(true);
        } catch(e) {
            setUploadResult({ status:"error", message: String(e) });
        }
        setUploading(false);
    }, []);

    const runForecast = useCallback(async () => {
        setLoading(true); setSaveOk(false);
        try {
            // For specific-date mode, pass the target date as start_datetime
            const body: any = { save:true, notes: mode==="live"?"live":`specific:${targetDate}`, hours_ahead:24 };
            if (mode === "specific") {
                body.start_datetime = `${targetDate}T00:00:00`;
            }
            const r = await fetch(`${BASE}/api/live/forecast`, {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify(body),
            });
            const d = await r.json();
            setForecast(d);
            if (d.run_id) setSaveOk(true);
            fetchWeather();
        } catch {}
        setLoading(false);
    }, [mode, targetDate, fetchWeather]);

    // ── Computed chart data ─────────────────────────────────────────────────────
    const ri         = ALL_TABS.find(r => r.id === selected) ?? ALL_TABS[0];
    const regionObj  = forecast?.regions?.[selected];
    const rdata      = Array.isArray(regionObj) ? regionObj : (regionObj?.forecast ?? []);
    const scaleInfo  = (!Array.isArray(regionObj)) && regionObj?.scale_info;
    const isAllIndia = selected === "ALL_INDIA";
    const wx         = weather?.[selected];
    const allIndiaWx = weather?.["Northern_Region"];

    const chartData = Array.isArray(rdata) ? rdata.map((h:any) => ({
        label:    h.label ?? `${h.hour}:00`,
        Demand:   h.predicted_demand_mw,
        Capacity: h.capacity_mw,
        Solar:    h.solar_available_mw,
        Wind:     h.wind_available_mw,
        Hydro:    h.hydro_available_mw,
        Thermal:  h.thermal_available_mw,
        ci_lower: h.ci_lower_mw,
        ci_band:  (h.ci_upper_mw!=null&&h.ci_lower_mw!=null) ? Math.max(0,h.ci_upper_mw-h.ci_lower_mw) : undefined,
        temp_c:   h.weather_temp_c,
        solar_wm2:h.weather_solar_wm2,
    })) : [];

    const hasCI    = chartData.some(d => d.ci_lower != null);
    const overloads = chartData.filter(d => d.Demand!=null && d.Capacity!=null && d.Demand>d.Capacity);

    const demandVals  = chartData.map(d => d.Demand).filter(Boolean) as number[];
    const capVals     = chartData.map(d => d.Capacity).filter(Boolean) as number[];
    const demandMin   = demandVals.length ? Math.min(...demandVals) : 150000;
    const demandMax   = demandVals.length ? Math.max(...demandVals) : 250000;
    const capMax      = capVals.length    ? Math.max(...capVals)    : demandMax;
    const swing       = demandMax - demandMin;
    const pad         = Math.max(swing * 0.12, 2000);
    const yMin        = Math.floor((demandMin - pad) / 2000) * 2000;
    const yMax        = Math.ceil((Math.min(capMax, demandMax + swing * 0.6) + pad) / 2000) * 2000;
    const useGW       = demandMax > 50_000;
    const fmtY        = (v: number) => useGW ? `${(v/1000).toFixed(1)}` : `${(v/1000).toFixed(0)}K`;

    const S: any = {
        root:  { minHeight:"100vh", background:"#0a0f14", color:"#e8f4f1", fontFamily:"'Exo 2','Segoe UI',sans-serif", padding:"12px 24px" },
        panel: { background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:16 },
        lbl:   { fontSize:10, letterSpacing:"0.12em", color:"rgba(232,244,241,0.45)", textTransform:"uppercase" as const, marginBottom:10 },
    };

    const todayStr = new Date().toISOString().slice(0,10);

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:4}}>
                <div>
                    <div style={{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"}}>
                        ⚡ Forecast — Powered by MERIT India Data
                    </div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:2,fontFamily:"monospace"}}>
                        33-feature Random Forest · Weather-enhanced capacity · Real demand history
                    </div>
                </div>

            </div>

            {/* ── Step indicator ── */}
            <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:20}}>
                {[
                    {n:1,label:"Choose what to predict"},
                    {n:2,label:"Upload demand history"},
                    {n:3,label:"View forecast"},
                ].map((s,i)=>(
                    <div key={s.n} style={{display:"flex",alignItems:"center"}}>
                        <div onClick={()=>{ if(s.n<step||(s.n===2&&step===3)) setStep(s.n as any); }}
                             style={{cursor:s.n<=step?"pointer":"default"}}>
                            <StepBadge n={s.n} label={s.label} active={step===s.n} done={step>s.n}/>
                        </div>
                        {i<2&&<div style={{width:40,height:1,background:"rgba(255,255,255,0.08)",margin:"0 12px"}}/>}
                    </div>
                ))}
                {saveOk && forecast?.run_id && step===3 && (
                    <div style={{marginLeft:"auto",fontSize:10,fontFamily:"monospace",color:"rgba(0,212,170,0.6)"}}>
                        ✓ Saved as <span style={{color:"#00d4aa"}}>{forecast.run_id}</span>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════
          STEP 1 — Choose mode
      ══════════════════════════════════════════════════════════════════ */}
            {step === 1 && (
                <div style={{maxWidth:640}}>
                    <div style={S.panel}>
                        <div style={S.lbl}>What do you want to predict?</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                            {/* Live / Next 24h */}
                            <div onClick={()=>setMode("live")} style={{
                                padding:16, borderRadius:8, cursor:"pointer",
                                background:mode==="live"?"rgba(0,212,170,0.08)":"rgba(255,255,255,0.03)",
                                border:`2px solid ${mode==="live"?"#00d4aa":"rgba(255,255,255,0.08)"}`,
                            }}>
                                <div style={{fontSize:22,marginBottom:8}}>⚡</div>
                                <div style={{fontSize:13,fontWeight:600,color:mode==="live"?"#00d4aa":"#e8f4f1",marginBottom:4}}>
                                    Next 24 hours
                                </div>
                                <div style={{fontSize:11,color:"rgba(232,244,241,0.5)",lineHeight:1.6}}>
                                    Forecast starting from right now. Uses today's uploaded demand data as history and live weather from Open-Meteo.
                                </div>
                                <div style={{marginTop:10,fontSize:10,fontFamily:"monospace",
                                    color:mode==="live"?"rgba(0,212,170,0.7)":"rgba(232,244,241,0.3)"}}>
                                    Start: {new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"})} IST → next 24h
                                </div>
                            </div>

                            {/* Specific date */}
                            <div onClick={()=>setMode("specific")} style={{
                                padding:16, borderRadius:8, cursor:"pointer",
                                background:mode==="specific"?"rgba(245,158,11,0.08)":"rgba(255,255,255,0.03)",
                                border:`2px solid ${mode==="specific"?"#f59e0b":"rgba(255,255,255,0.08)"}`,
                            }}>
                                <div style={{fontSize:22,marginBottom:8}}>📅</div>
                                <div style={{fontSize:13,fontWeight:600,color:mode==="specific"?"#f59e0b":"#e8f4f1",marginBottom:4}}>
                                    Specific date
                                </div>
                                <div style={{fontSize:11,color:"rgba(232,244,241,0.5)",lineHeight:1.6}}>
                                    Predict demand for any date — tomorrow, next week, or a past date you want to validate against actual data.
                                </div>
                                {mode==="specific"&&(
                                    <div style={{marginTop:10}} onClick={e=>e.stopPropagation()}>
                                        <input type="date" value={targetDate}
                                               onChange={e=>setTargetDate(e.target.value)}
                                               style={{width:"100%",boxSizing:"border-box",
                                                   background:"rgba(255,255,255,0.06)",border:"1px solid rgba(245,158,11,0.4)",
                                                   color:"#e8f4f1",borderRadius:6,padding:"6px 10px",fontFamily:"monospace",fontSize:11}}/>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button onClick={()=>setStep(2)} style={{
                            width:"100%",padding:"10px",background:"rgba(0,212,170,0.12)",
                            border:"1px solid rgba(0,212,170,0.4)",color:"#00d4aa",
                            borderRadius:7,fontFamily:"monospace",fontSize:12,fontWeight:600,cursor:"pointer",
                        }}>
                            Continue → Upload demand data
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
          STEP 2 — Upload MERIT files
      ══════════════════════════════════════════════════════════════════ */}
            {step === 2 && (
                <div style={{maxWidth:640}}>
                    <div style={S.panel}>
                        {/* What we need */}
                        <div style={S.lbl}>Upload previous 7–8 days of demand data</div>
                        <div style={{padding:"10px 14px",background:"rgba(0,212,170,0.05)",border:"1px solid rgba(0,212,170,0.15)",borderRadius:7,marginBottom:14,fontSize:11,color:"rgba(232,244,241,0.6)",lineHeight:1.8}}>
                            <strong style={{color:"#00d4aa"}}>Why?</strong> The model needs 168 hours (7 days) of real demand history to predict the next 24 hours accurately. Without it, predictions are based on scaled 2022 data which is less reliable.
                            <br/>
                            <strong style={{color:"#00d4aa"}}>How to get the files:</strong> Open{" "}
                            <a href="https://npp.gov.in/dashBoard/gc-map-dashboard-meritchart" target="_blank"
                               style={{color:"#00d4aa"}}>npp.gov.in merit chart</a>
                            {" "}→ "Previous Data" → select each of the last 7 days → Download CSV
                        </div>

                        {/* Upload drop zone */}
                        <label style={{cursor:uploading?"not-allowed":"pointer",display:"block",marginBottom:12}}>
                            <input type="file" accept=".csv" multiple style={{display:"none"}}
                                   disabled={uploading}
                                   onChange={e=>{
                                       if(!e.target.files?.length) return;
                                       const f = Array.from(e.target.files);
                                       setUploadedFiles(f);
                                       uploadFiles(f);
                                   }}/>
                            <div style={{
                                border:`2px dashed ${uploadedFiles.length>0?"rgba(0,212,170,0.5)":"rgba(255,255,255,0.15)"}`,
                                borderRadius:8, padding:"24px 16px", textAlign:"center",
                                background:uploading?"rgba(0,212,170,0.04)":"transparent",
                            }}>
                                <div style={{fontSize:28,marginBottom:8}}>{uploading?"⏳":uploadedFiles.length>0?"✅":"📁"}</div>
                                <div style={{fontSize:12,color:uploadedFiles.length>0?"#00d4aa":"rgba(232,244,241,0.5)",marginBottom:4}}>
                                    {uploading ? "Uploading and processing…"
                                        : uploadedFiles.length>0 ? `${uploadedFiles.length} file${uploadedFiles.length>1?"s":""} selected`
                                            : "Click to select MERIT CSV files"}
                                </div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.3)"}}>
                                    {uploadedFiles.length>0
                                        ? uploadedFiles.map(f=>f.name).join(", ").slice(0,80)+(uploadedFiles.map(f=>f.name).join(", ").length>80?"…":"")
                                        : "Select all 7–8 files at once · Ctrl+click or Shift+click to select multiple"}
                                </div>
                            </div>
                        </label>

                        {/* Upload result */}
                        {uploadResult && (
                            <div style={{marginBottom:12,padding:"10px 14px",borderRadius:7,fontSize:11,
                                background:uploadResult.status==="ok"?"rgba(0,212,170,0.07)":"rgba(255,77,106,0.07)",
                                border:`1px solid ${uploadResult.status==="ok"?"rgba(0,212,170,0.25)":"rgba(255,77,106,0.25)"}`,
                                color:uploadResult.status==="ok"?"#00d4aa":"#ff4d6a",lineHeight:1.7}}>
                                {uploadResult.status==="ok" ? (
                                    <>
                                        ✓ <strong>{uploadResult.hours_available}h</strong> of real demand history ready
                                        · Coverage: <strong>{uploadResult.data_quality?.coverage_pct}%</strong>
                                        · Mean: <strong>{(uploadResult.mean_demand_mw/1000).toFixed(1)} GW</strong>
                                        · Peak: <strong>{(uploadResult.peak_demand_mw/1000).toFixed(1)} GW</strong>
                                        {uploadResult.gap_warning && (
                                            <div style={{marginTop:6,color:"#ffb347",fontSize:10}}>
                                                ⚠ {uploadResult.gap_warning}
                                            </div>
                                        )}
                                    </>
                                ) : `✗ ${uploadResult.message || "Upload failed"}`}
                            </div>
                        )}

                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                            <button onClick={()=>setStep(1)} style={{
                                padding:"9px",background:"transparent",border:"1px solid rgba(255,255,255,0.12)",
                                color:"rgba(232,244,241,0.4)",borderRadius:7,fontFamily:"monospace",fontSize:11,cursor:"pointer",
                            }}>
                                ← Back
                            </button>
                            <button
                                onClick={()=>{ setStep(3); runForecast(); }}
                                disabled={!meritReady && uploadedFiles.length===0}
                                style={{
                                    padding:"9px",
                                    background: (meritReady || uploadedFiles.length>0) ? "rgba(0,212,170,0.15)" : "rgba(255,255,255,0.04)",
                                    border:`1px solid ${(meritReady||uploadedFiles.length>0)?"rgba(0,212,170,0.4)":"rgba(255,255,255,0.08)"}`,
                                    color:(meritReady||uploadedFiles.length>0)?"#00d4aa":"rgba(232,244,241,0.25)",
                                    borderRadius:7,fontFamily:"monospace",fontSize:11,
                                    cursor:(meritReady||uploadedFiles.length>0)?"pointer":"not-allowed",fontWeight:600,
                                }}>
                                {meritReady||uploadedFiles.length>0 ? "⚡ Run Forecast →" : "Upload files first"}
                            </button>
                        </div>

                        {/* Skip option */}
                        <div style={{textAlign:"center",marginTop:10}}>
                            <button onClick={()=>{ setStep(3); runForecast(); }} style={{
                                background:"transparent",border:"none",
                                color:"rgba(232,244,241,0.3)",fontSize:10,cursor:"pointer",fontFamily:"monospace",
                            }}>
                                Skip upload and use scaled historical data ↓
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
          STEP 3 — Forecast results
      ══════════════════════════════════════════════════════════════════ */}
            {step === 3 && (
                <>
                    {/* Status bar */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                        <div style={{padding:"6px 12px",background:"rgba(255,255,255,0.03)",borderRadius:6,
                            border:"1px solid rgba(255,255,255,0.08)",fontSize:11,color:"rgba(232,244,241,0.6)"}}>
                            {mode==="live"
                                ? `⚡ Next 24h from now`
                                : `📅 Forecast for ${targetDate}`}
                        </div>
                        {scaleInfo && (
                            <div style={{fontSize:10,fontFamily:"monospace",padding:"5px 10px",borderRadius:5,
                                background:scaleInfo.source==="merit_india_csv"?"rgba(0,212,170,0.07)":"rgba(255,179,71,0.07)",
                                border:`1px solid ${scaleInfo.source==="merit_india_csv"?"rgba(0,212,170,0.25)":"rgba(255,179,71,0.25)"}`,
                                color:scaleInfo.source==="merit_india_csv"?"#00d4aa":"#ffb347"}}>
                                {scaleInfo.source==="merit_india_csv"
                                    ? `✓ Real demand history used (MERIT India CSV)`
                                    : `⚠ Scaled historical data (×${scaleInfo.total_scale?.toFixed(3)})`}
                            </div>
                        )}
                        {forecast?.weather_source && (
                            <div style={{fontSize:10,fontFamily:"monospace",padding:"5px 10px",borderRadius:5,
                                background: forecast.weather_source.includes("archive") ? "rgba(77,166,255,0.07)"
                                    : forecast.weather_source.includes("forecast") ? "rgba(0,212,170,0.07)"
                                        : forecast.weather_source.includes("climatology") ? "rgba(255,179,71,0.07)"
                                            : "rgba(255,255,255,0.04)",
                                border:`1px solid ${
                                    forecast.weather_source.includes("archive") ? "rgba(77,166,255,0.25)"
                                        : forecast.weather_source.includes("forecast") ? "rgba(0,212,170,0.25)"
                                            : "rgba(255,179,71,0.25)"}`,
                                color: forecast.weather_source.includes("archive") ? "#4da6ff"
                                    : forecast.weather_source.includes("forecast") ? "#00d4aa"
                                        : "#ffb347",
                            }}>
                                {forecast.weather_source.includes("archive")     ? "📚 Weather: historical archive"
                                    : forecast.weather_source.includes("open-meteo-live") ? "⚡ Weather: live Open-Meteo"
                                        : forecast.weather_source.includes("forecast")   ? "🔭 Weather: NWP forecast"
                                            : "⚠ Weather: climatological averages"}
                            </div>
                        )}
                        <button onClick={()=>{ setStep(2); setForecast(null); setMeritReady(false); setUploadedFiles([]); setUploadResult(null); }}
                                style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                                    color:"rgba(232,244,241,0.4)",borderRadius:6,padding:"5px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                            ← New forecast
                        </button>
                        <button onClick={()=>runForecast()} disabled={loading}
                                style={{background:"rgba(0,212,170,0.12)",border:"1px solid rgba(0,212,170,0.3)",
                                    color:"#00d4aa",borderRadius:6,padding:"5px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                            {loading?"Running…":"↻ Re-run"}
                        </button>
                    </div>

                    {loading && (
                        <div style={{...S.panel,textAlign:"center",padding:"40px 16px",marginBottom:14}}>
                            <div style={{fontFamily:"monospace",fontSize:13,color:"#00d4aa",marginBottom:8}}>
                                Running 5 regional models…
                            </div>
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.4)"}}>
                                33-feature Random Forest · Weather-enhanced capacity engine · CI bands
                            </div>
                        </div>
                    )}

                    {!loading && forecast && (
                        <>
                            {/* Region tabs */}
                            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                                {ALL_TABS.map(r=>{
                                    const robj = forecast?.regions?.[r.id];
                                    const rd   = Array.isArray(robj)?robj:(robj?.forecast??[]);
                                    const peak = Array.isArray(rd)?Math.max(...rd.map((h:any)=>h.predicted_demand_mw||0)):0;
                                    const ol   = Array.isArray(rd)&&rd.some((h:any)=>h.predicted_demand_mw>h.capacity_mw);
                                    return (
                                        <button key={r.id} onClick={()=>setSelected(r.id)} style={{
                                            background:selected===r.id?`${r.color}18`:"rgba(255,255,255,0.03)",
                                            border:`1px solid ${selected===r.id?r.color+"60":"rgba(255,255,255,0.07)"}`,
                                            borderTop:`2px solid ${selected===r.id?r.color:"transparent"}`,
                                            borderRadius:7,padding:"8px 14px",cursor:"pointer",
                                            minWidth:r.id==="ALL_INDIA"?155:120,
                                        }}>
                                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
                        <span style={{fontSize:r.id==="ALL_INDIA"?12:11,
                            fontWeight:r.id==="ALL_INDIA"?700:500,
                            color:selected===r.id?r.color:"#e8f4f1"}}>
                          {r.id==="ALL_INDIA"?"🇮🇳 ":""}{r.label}
                        </span>
                                                {ol&&<span style={{fontSize:9,color:"#ff4d6a"}}>⚠</span>}
                                            </div>
                                            <div style={{fontFamily:"monospace",fontSize:10,color:"rgba(232,244,241,0.4)",marginTop:2}}>
                                                {peak>0?`${(peak/1000).toFixed(0)}K MW`:"—"}
                                                {r.id==="ALL_INDIA"&&peak>0&&<span style={{fontSize:8,color:"rgba(232,244,241,0.3)",marginLeft:4}}>total</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* All-India KPI cards */}
                            {isAllIndia && rdata.length > 0 && (()=>{
                                const peak   = Math.max(...rdata.map((h:any)=>h.predicted_demand_mw||0));
                                const trough = Math.min(...rdata.map((h:any)=>h.predicted_demand_mw||0));
                                const maxCap = Math.max(...rdata.map((h:any)=>h.capacity_mw||0));
                                const olHrs  = rdata.filter((h:any)=>h.predicted_demand_mw>h.capacity_mw).length;
                                return (
                                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:14}}>
                                        {[
                                            {label:"Peak Demand",   val:`${(peak/1000).toFixed(1)} GW`,          sub:rdata.find((h:any)=>h.predicted_demand_mw===peak)?.label??"—",  c:"#ffb347"},
                                            {label:"Trough Demand", val:`${(trough/1000).toFixed(1)} GW`,         sub:rdata.find((h:any)=>h.predicted_demand_mw===trough)?.label??"—",c:"#4da6ff"},
                                            {label:"Max Available", val:`${(maxCap/1000).toFixed(1)} GW`,          sub:"dynamic capacity", c:"#f59e0b"},
                                            {label:"Diurnal Swing", val:`${((peak-trough)/1000).toFixed(1)} GW`,   sub:"peak – trough",    c:"#c084fc"},
                                            {label:"Overload Hours",val:String(olHrs), sub:"of 24 hours",           c:olHrs>0?"#ff4d6a":"#00d4aa"},
                                        ].map(m=>(
                                            <div key={m.label} style={{background:"rgba(255,255,255,0.025)",
                                                border:`1px solid ${m.c}25`,borderRadius:8,padding:"10px 14px",
                                                borderTop:`2px solid ${m.c}`}}>
                                                <div style={{fontFamily:"monospace",fontSize:20,fontWeight:700,color:m.c}}>{m.val}</div>
                                                <div style={{fontSize:10,color:"rgba(232,244,241,0.5)",marginTop:3}}>{m.label}</div>
                                                <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",marginTop:1,fontFamily:"monospace"}}>{m.sub}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Main forecast chart */}
                            <div style={{...S.panel,marginBottom:14}}>
                                <div style={{...S.lbl,display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                                    <div style={{width:7,height:7,borderRadius:2,background:ri.color}}/>
                                    24h Forecast — {ri.label}
                                    {forecast?.weather_source?.includes("live")&&
                                        <span style={{color:"#f59e0b",fontSize:9}}>⚡ weather-enhanced capacity</span>}
                                    {overloads.length>0&&
                                        <span style={{marginLeft:"auto",color:"#ff4d6a"}}>
                      ⚠ {overloads.length} overload hour{overloads.length>1?"s":""}
                    </span>}
                                </div>
                                <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap"}}>
                                    {[{c:"#00d4aa",l:"Forecast demand",d:false},{c:"#f59e0b",l:"Available capacity",d:true}].map(l=>(
                                        <div key={l.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(232,244,241,0.5)"}}>
                                            <svg width={20} height={6}><line x1={0} y1={3} x2={20} y2={3} stroke={l.c} strokeWidth={2} strokeDasharray={l.d?"6 3":undefined}/></svg>{l.l}
                                        </div>
                                    ))}
                                    {hasCI&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(232,244,241,0.5)"}}>
                                        <div style={{width:14,height:8,background:"rgba(0,212,170,0.12)",border:"1px solid #00d4aa",borderRadius:2}}/>80% CI
                                    </div>}
                                </div>
                                <ResponsiveContainer width="100%" height={260}>
                                    <ComposedChart data={chartData} margin={{top:4,right:12,left:0,bottom:0}}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                                        <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={{stroke:"rgba(255,255,255,0.08)"}} tickLine={false} interval={3}/>
                                        <YAxis tickFormatter={fmtY} tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} width={useGW?44:38} domain={[yMin,yMax]} label={useGW?{value:"GW",angle:-90,position:"insideLeft",fill:"rgba(232,244,241,0.2)",fontSize:9,dx:10}:undefined}/>
                                        <Tooltip content={<Tip/>}/>
                                        {hasCI&&<Area type="monotone" dataKey="ci_lower" stroke="none" fill="none" dot={false} isAnimationActive={false} legendType="none"/>}
                                        {hasCI&&<Area type="monotone" dataKey="ci_band" stackId="ci" stroke="none" fill="rgba(0,212,170,0.10)" dot={false} isAnimationActive={false} legendType="none"/>}
                                        <Area type="monotone" dataKey="Demand" stroke="#00d4aa" strokeWidth={2} fill="rgba(0,212,170,0.07)" dot={false} isAnimationActive={false}/>
                                        <Line type="monotone" dataKey="Capacity" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="6 3" dot={false} isAnimationActive={false}/>
                                        {overloads.map(d=><ReferenceDot key={d.label} x={d.label} y={d.Capacity} r={4} fill="#ff4d6a" stroke="#0d1821" strokeWidth={1.5}/>)}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Generation mix + weather */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                                <div style={S.panel}>
                                    <div style={S.lbl}>{isAllIndia?"⚙ All-India Generation Mix":`⚙ Generation Mix — ${ri.label}`}</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}} barSize={10}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                                            <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.3)",fontSize:8}} axisLine={false} tickLine={false} interval={5}/>
                                            <YAxis tick={{fill:"rgba(232,244,241,0.3)",fontSize:8}} axisLine={false} tickLine={false} width={34} tickFormatter={(v:number)=>`${(v/1000).toFixed(0)}K`}/>
                                            <Tooltip contentStyle={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.2)",fontSize:10}}/>
                                            <Bar dataKey="Thermal" fill="#ff7043" fillOpacity={0.85} stackId="c"/>
                                            <Bar dataKey="Hydro"   fill="#26c6da" fillOpacity={0.85} stackId="c"/>
                                            <Bar dataKey="Wind"    fill="#29b6f6" fillOpacity={0.85} stackId="c"/>
                                            <Bar dataKey="Solar"   fill="#ffd60a" fillOpacity={0.85} stackId="c"/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
                                        {[{c:"#ffd60a",l:"Solar"},{c:"#29b6f6",l:"Wind"},{c:"#26c6da",l:"Hydro"},{c:"#ff7043",l:"Thermal"}].map(x=>(
                                            <div key={x.l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"rgba(232,244,241,0.45)"}}>
                                                <div style={{width:8,height:8,borderRadius:2,background:x.c}}/>{x.l}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={S.panel}>
                                    <div style={S.lbl}>{isAllIndia?"🌡 Weather — Delhi (national representative)":`🌡 Forecast Weather — ${wx?.city??ri.city}`}</div>
                                    {((isAllIndia?allIndiaWx:wx)?.hourly) ? (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <ComposedChart data={(isAllIndia?allIndiaWx:wx)?.hourly?.map((w:any)=>({label:`${new Date(w.timestamp).getHours()}:00`,temp_c:w.temp_c,solar:w.solar_wm2}))||[]} margin={{top:4,right:8,left:0,bottom:0}}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                                                <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.3)",fontSize:8}} axisLine={false} tickLine={false} interval={3}/>
                                                <YAxis yAxisId="t" tick={{fill:"#f59e0b",fontSize:8}} axisLine={false} tickLine={false} width={24} unit="°"/>
                                                <YAxis yAxisId="s" orientation="right" tick={{fill:"#ffd60a",fontSize:8}} axisLine={false} tickLine={false} width={30} unit="W"/>
                                                <Tooltip contentStyle={{background:"#0d1821",border:"1px solid rgba(245,158,11,0.2)",fontSize:10}}/>
                                                <Area yAxisId="s" type="monotone" dataKey="solar" stroke="#ffd60a" fill="rgba(255,214,10,0.12)" strokeWidth={1.5} dot={false} name="Solar W/m²"/>
                                                <Line yAxisId="t" type="monotone" dataKey="temp_c" stroke="#f59e0b" strokeWidth={2} dot={false} name="Temp °C"/>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
                                            <span style={{color:"rgba(232,244,241,0.25)",fontSize:11}}>Weather data unavailable</span>
                                            <button onClick={fetchWeather} style={{fontSize:10,color:"rgba(0,212,170,0.6)",background:"transparent",border:"1px solid rgba(0,212,170,0.2)",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontFamily:"monospace"}}>Fetch weather</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hourly status strip */}
                            <div style={S.panel}>
                                <div style={S.lbl}>Hourly Grid Status — {ri.label}</div>
                                <div style={{display:"grid",gridTemplateColumns:"repeat(24,minmax(0,1fr))",gap:3}}>
                                    {chartData.map((d,i)=>{
                                        const ratio = d.Capacity>0 ? Math.min((d.Demand??0)/d.Capacity,1.2) : 0;
                                        const over  = d.Demand!=null && d.Capacity!=null && d.Demand>d.Capacity;
                                        return (
                                            <div key={i}
                                                 title={`${d.label}: ${((d.Demand??0)/1000).toFixed(1)}GW demand / ${((d.Capacity??0)/1000).toFixed(1)}GW cap${d.temp_c!=null?` | ${d.temp_c}°C`:""}`}
                                                 style={{height:50,borderRadius:3,cursor:"default",
                                                     background:over?"rgba(255,77,106,0.7)":`rgba(0,212,170,${0.08+ratio*0.6})`,
                                                     border:over?"1px solid rgba(255,77,106,0.8)":"1px solid rgba(255,255,255,0.03)",
                                                     display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",paddingBottom:2}}>
                                                <span style={{fontFamily:"monospace",fontSize:7,color:over?"#ff4d6a":"rgba(232,244,241,0.4)"}}>{i}</span>
                                                {d.temp_c!=null&&<span style={{fontSize:6,color:over?"#ff4d6a":"#f59e0b"}}>{Math.round(d.temp_c)}°</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{display:"flex",gap:14,marginTop:8,fontSize:10,color:"rgba(232,244,241,0.35)"}}>
                                    <span>Colour = demand/capacity ratio</span>
                                    <span>🔴 = over capacity</span>
                                    <span style={{marginLeft:"auto",fontFamily:"monospace"}}>Hover for GW values + temperature</span>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}