"use client";

import { useState, useCallback, useEffect } from "react";
import {
    ResponsiveContainer, ComposedChart, BarChart, Bar,
    Line, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    ReferenceLine, Cell,
} from "recharts";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const REGIONS = [
    { id:"Northern_Region",     label:"Northern", color:"#4da6ff" },
    { id:"Western_Region",      label:"Western",  color:"#ffb347" },
    { id:"Southern_Region",     label:"Southern", color:"#00d4aa" },
    { id:"Eastern_Region",      label:"Eastern",  color:"#ff4d6a" },
    { id:"NorthEastern_Region", label:"NE Region",color:"#c084fc" },
];
const ALL_INDIA_TAB = { id:"ALL_INDIA", label:"All-India", color:"#e8f4f1" };
const ALL_REGION_TABS = [...REGIONS, ALL_INDIA_TAB];

const Tip = ({active,payload,label}:any) => {
    if(!active||!payload?.length) return null;
    return (
        <div style={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.25)",borderRadius:6,padding:"9px 13px",fontSize:11}}>
            <p style={{color:"#00d4aa",marginBottom:4,fontFamily:"monospace"}}>{label}</p>
            {payload.map((p:any)=>(
                <p key={p.name} style={{color:p.color??p.stroke??"#e8f4f1",margin:"2px 0"}}>
                    {p.name}: <strong>{typeof p.value==="number"?`${p.value.toLocaleString()} MW`:p.value}</strong>
                </p>
            ))}
        </div>
    );
};

export default function ComparePage() {
    // ── State ───────────────────────────────────────────────────────────────────
    const [predictions,  setPredictions]  = useState<any[]>([]);
    const [predLoading,  setPredLoading]  = useState(false);
    const [selectedRun,  setSelectedRun]  = useState<string|null>(null);
    const [comparison,   setComparison]   = useState<any>(null);
    const [cmpLoading,   setCmpLoading]   = useState(false);
    const [performance,  setPerformance]  = useState<any>(null);
    const [selectedReg,  setSelectedReg]  = useState("ALL_INDIA");

    // Upload actuals
    const [uploading,    setUploading]    = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [uploadedDates, setUploadedDates] = useState<string[]>([]);

    // Live capacity from current capacity engine (replaces stale DB values)
    const [liveCapacity, setLiveCapacity] = useState<any>(null);

    // ── API calls ────────────────────────────────────────────────────────────────
    const loadPredictions = useCallback(async()=>{
        setPredLoading(true);
        try {
            const r = await fetch(`${BASE}/api/live/predictions?limit=50`);
            const d = await r.json();
            setPredictions(d.predictions ?? []);
        } catch {}
        setPredLoading(false);
    },[]);

    const loadComparison = useCallback(async(runId:string)=>{
        setCmpLoading(true); setComparison(null); setLiveCapacity(null);
        try {
            // Load comparison and live All-India 24h capacity in parallel
            const [compRes, capRes] = await Promise.all([
                fetch(`${BASE}/api/live/compare/${encodeURIComponent(runId)}?auto_fetch=false`),
                fetch(`${BASE}/api/capacity/all-india-24h`),
            ]);
            const [compData, capData] = await Promise.all([compRes.json(), capRes.json()]);
            setComparison(compData);
            // Build a lookup: hour → total_available_mw from current capacity engine
            if (capData?.hours) {
                const lookup: Record<number,number> = {};
                capData.hours.forEach((h:any) => { lookup[h.hour] = h.total_available_mw; });
                setLiveCapacity(lookup);
            }
        } catch {}
        setCmpLoading(false);
    },[]);

    const loadPerformance = useCallback(async()=>{
        try {
            const r = await fetch(`${BASE}/api/live/rolling-performance?days=30`);
            const d = await r.json();
            setPerformance(d);
        } catch {}
    },[]);

    const uploadActuals = useCallback(async(files: FileList)=>{
        if(!files.length) return;
        setUploading(true); setUploadResult(null);
        const form = new FormData();
        Array.from(files).forEach(f => form.append("files", f));
        try {
            const r = await fetch(`${BASE}/api/upload/actual-demand`, {method:"POST", body:form});
            const d = await r.json();
            setUploadResult(d);
            if(d.saved > 0) {
                const dates = (d.results ?? [])
                    .filter((r:any) => r.status==="saved")
                    .map((r:any) => r.date);
                setUploadedDates(prev => [...new Set([...prev, ...dates])]);
                loadPredictions();
                loadPerformance();
                // Auto-compare if a run is selected and its date matches
                if(selectedRun && comparison?.forecast_date && dates.includes(comparison.forecast_date)) {
                    loadComparison(selectedRun);
                }
            }
        } catch(e) {
            setUploadResult({saved:0, message:`Upload failed: ${e}`});
        }
        setUploading(false);
    },[loadPredictions, loadPerformance, selectedRun, comparison, loadComparison]);

    useEffect(()=>{ loadPredictions(); loadPerformance(); },[]);

    const handleSelectRun = (runId:string) => {
        setSelectedRun(runId);
        loadComparison(runId);
    };

    // ── Derived data ─────────────────────────────────────────────────────────────
    const isAllIndia = selectedReg === "ALL_INDIA";
    // For ALL_INDIA: use all_india_summary for KPIs, aggregate hourly from all regions
    const regionCmp = isAllIndia
        ? comparison?.all_india_summary
            ? {
                predicted_daily_mu: comparison.all_india_summary.predicted_mu,
                actual_daily_mu:    comparison.all_india_summary.actual_mu,
                error_mu:           comparison.all_india_summary.error_mu,
                error_pct:          comparison.all_india_summary.error_pct,
                mae_mu:             comparison.all_india_summary.mae_mu,
                mape_pct:           comparison.all_india_summary.error_pct!=null
                    ? Math.abs(comparison.all_india_summary.error_pct) : null,
                predicted_peak_mw:  comparison?.regions
                    ? Math.max(...Object.values(comparison.regions as any)
                        .filter((v:any) => v.hourly_forecast?.length)
                        .flatMap((v:any) => v.hourly_forecast.map((h:any) => h.predicted_mw || 0)))
                    : null,
                hourly_forecast: (() => {
                    // Sum all 5 regional hourly forecasts for All-India hourly chart
                    if (!comparison?.regions) return [];
                    const regionForecasts = Object.values(comparison.regions as any)
                        .filter((v:any) => v.hourly_forecast?.length);
                    if (!regionForecasts.length) return [];
                    const len = (regionForecasts[0] as any).hourly_forecast.length;
                    return Array.from({length:len}, (_,i) => {
                        const base = (regionForecasts[0] as any).hourly_forecast[i];
                        return {
                            ...base,
                            predicted_mw: regionForecasts.reduce(
                                (s:number, r:any) => s + (r.hourly_forecast[i]?.predicted_mw || 0), 0
                            ),
                            capacity_mw: regionForecasts.reduce(
                                (s:number, r:any) => s + (r.hourly_forecast[i]?.capacity_mw || 0), 0
                            ),
                        };
                    });
                })(),
                // For ALL_INDIA hourly actual: use raw All-India values (no share splitting)
                hourly_actual: comparison?.regions?.["ALL_INDIA_HOURLY"]?.ntpc_actual_mu
                    ? (() => {
                        try { return JSON.parse(comparison.regions["ALL_INDIA_HOURLY"].ntpc_actual_mu); }
                        catch { return comparison.regions?.Northern_Region?.hourly_actual ?? {}; }
                    })()
                    : (Object.values(comparison?.regions ?? {}) as any[])[0]?.hourly_actual ?? {},
            }
            : null
        : comparison?.regions?.[selectedReg];

    // Hourly chart: predicted + actual overlaid
    const hourlyChart = (() => {
        const forecast  = regionCmp?.hourly_forecast ?? [];
        const actualMap = regionCmp?.hourly_actual ?? {};
        return forecast.map((h:any) => {
            const lbl = h.timestamp
                ? new Date(h.timestamp).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Kolkata"})
                : `${h.hour}:00`;
            const actualKey = Object.keys(actualMap).find(k => k.startsWith(lbl.slice(0,2)));
            const actualAll = actualKey ? actualMap[actualKey] : undefined;

            // Use the same dynamic per-hour share that was applied at forecast time.
            // h.region_share is stored in the DB when the forecast is saved.
            // This ensures actual and predicted use identical share — no artificial mismatch.
            // For All-India: share = 1.0 (no splitting needed)
            const share = isAllIndia ? 1.0 : (h.region_share ?? (
                {Northern_Region:0.2988,Western_Region:0.3139,Southern_Region:0.2592,
                    Eastern_Region:0.1159,NorthEastern_Region:0.0122}[selectedReg] ?? 0.2
            ));

            const liveCapMw = liveCapacity?.[h.hour];
            const capMw = liveCapMw
                ? (isAllIndia ? liveCapMw : Math.round(liveCapMw * share))
                : h.capacity_mw;
            return {
                label:     lbl,
                Predicted: h.predicted_mw,
                Capacity:  capMw,
                Actual:    actualAll != null ? Math.round(actualAll * share) : undefined,
            };
        });
    })();

    const hasActualHourly = hourlyChart.some((h:any) => h.Actual != null);

    // Error bar chart
    const errorData = comparison?.regions
        ? Object.entries(comparison.regions)
            .filter(([,v]:any) => v.error_mu != null)
            .map(([rid, v]:any) => ({
                region:    REGIONS.find(r=>r.id===rid)?.label ?? rid,
                color:     REGIONS.find(r=>r.id===rid)?.color ?? "#e8f4f1",
                error_mu:  v.error_mu,
                mape:      v.mape_pct,
                pred_mu:   v.predicted_daily_mu,
                actual_mu: v.actual_daily_mu,
            }))
        : [];

    // Y-axis: base range on demand (predicted + actual), show capacity separately
    const demandVals = hourlyChart.flatMap((d:any) =>
        [d.Predicted, d.Actual].filter(Boolean)
    ) as number[];
    const capVals = hourlyChart.map((d:any) => d.Capacity).filter(Boolean) as number[];
    const cMin   = demandVals.length ? Math.min(...demandVals) : 0;
    const dMax2  = demandVals.length ? Math.max(...demandVals) : 100000;
    const capMax = capVals.length    ? Math.max(...capVals)    : dMax2;
    const cMax   = Math.max(dMax2, capMax);
    const cSwing = dMax2 - cMin;
    const cPad   = Math.max(cSwing * 0.12, 1000);
    const cYMin  = Math.floor((cMin  - cPad) / 2000) * 2000;
    const cYMax  = Math.ceil ((cMax  + cPad) / 2000) * 2000;
    const cFmt   = (v:number) => cMax > 50000 ? `${(v/1000).toFixed(1)}` : `${(v/1000).toFixed(0)}K`;

    const S:any = {
        root:  {minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"12px 24px"},
        panel: {background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:16},
        lbl:   {fontSize:10,letterSpacing:"0.12em",color:"rgba(232,244,241,0.45)",textTransform:"uppercase" as const,marginBottom:10},
    };

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:4}}>
                <div>
                    <div style={{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"}}>
                        ⚖ Prediction vs Actual
                    </div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:2}}>
                        Upload the MERIT India CSV for any date · Compare against saved forecasts · Track model accuracy
                    </div>
                </div>

            </div>

            <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:16,alignItems:"start"}}>

                {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
                <div style={{display:"flex",flexDirection:"column",gap:14}}>

                    {/* Rolling performance */}
                    {performance && (
                        <div style={{...S.panel,borderLeft:`3px solid ${
                                performance.samples===0?"rgba(255,255,255,0.1)":
                                    performance.mae_mu<500?"#00d4aa":performance.mae_mu<1000?"#ffb347":"#ff4d6a"}`}}>
                            <div style={S.lbl}>30-Day Rolling Accuracy</div>
                            {performance.samples===0 ? (
                                <div style={{fontSize:11,color:"rgba(232,244,241,0.35)",lineHeight:1.7}}>
                                    No comparisons yet. Upload actual demand files and select a saved forecast to populate this.
                                </div>
                            ) : (
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                    <div style={{textAlign:"center"}}>
                                        <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,
                                            color:performance.mae_mu<500?"#00d4aa":performance.mae_mu<1000?"#ffb347":"#ff4d6a"}}>
                                            {performance.mae_mu ?? "—"}
                                        </div>
                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)"}}>MAE (MU)</div>
                                    </div>
                                    <div style={{textAlign:"center"}}>
                                        <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:"#4da6ff"}}>
                                            {performance.samples}
                                        </div>
                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)"}}>Days compared</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Upload actual demand CSV ────────────────────────────────── */}
                    <div style={S.panel}>
                        <div style={S.lbl}>📥 Upload Actual Demand CSV</div>
                        <div style={{fontSize:11,color:"rgba(232,244,241,0.5)",marginBottom:12,lineHeight:1.7}}>
                            Download from{" "}
                            <a href="https://npp.gov.in/dashBoard/gc-map-dashboard-meritchart"
                               target="_blank" style={{color:"#00d4aa",textDecoration:"none"}}>
                                npp.gov.in merit chart ↗
                            </a>
                            {" "}→ "Previous Data" → select the date you want to compare → Download CSV.
                            Upload one file per day.
                        </div>

                        {/* Drop zone */}
                        <label style={{cursor:uploading?"not-allowed":"pointer",display:"block",marginBottom:10}}>
                            <input type="file" accept=".csv" multiple style={{display:"none"}}
                                   disabled={uploading}
                                   onChange={e => e.target.files && uploadActuals(e.target.files)}/>
                            <div style={{
                                border:`2px dashed ${uploadedDates.length>0?"rgba(0,212,170,0.4)":"rgba(255,255,255,0.12)"}`,
                                borderRadius:8,padding:"16px",textAlign:"center",
                                background:uploading?"rgba(0,212,170,0.04)":"transparent",
                            }}>
                                <div style={{fontSize:24,marginBottom:6}}>
                                    {uploading?"⏳":uploadedDates.length>0?"✅":"📁"}
                                </div>
                                <div style={{fontSize:11,color:uploadedDates.length>0?"#00d4aa":"rgba(232,244,241,0.45)",marginBottom:3}}>
                                    {uploading?"Processing…":"Click to upload actual demand CSV"}
                                </div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.3)"}}>
                                    Same format as the Forecast page uploads
                                </div>
                            </div>
                        </label>

                        {/* Upload result */}
                        {uploadResult && (
                            <div style={{fontSize:10,padding:"8px 12px",borderRadius:6,lineHeight:1.7,
                                background:uploadResult.saved>0?"rgba(0,212,170,0.07)":"rgba(255,77,106,0.07)",
                                border:`1px solid ${uploadResult.saved>0?"rgba(0,212,170,0.25)":"rgba(255,77,106,0.25)"}`,
                                color:uploadResult.saved>0?"#00d4aa":"#ff4d6a"}}>
                                {uploadResult.saved > 0 ? (
                                    <>
                                        ✓ Actuals saved for {uploadResult.saved} day{uploadResult.saved>1?"s":""}:
                                        {(uploadResult.results??[]).filter((r:any)=>r.status==="saved").map((r:any)=>(
                                            <div key={r.date} style={{paddingLeft:8,marginTop:2,color:"rgba(0,212,170,0.8)"}}>
                                                {r.date} · avg {(r.daily_avg_mw/1000).toFixed(1)} GW · peak {(r.peak_mw/1000).toFixed(1)} GW · {r.hours_covered}/24h
                                            </div>
                                        ))}
                                        <div style={{marginTop:6,color:"rgba(0,212,170,0.6)"}}>
                                            Now select a saved forecast below to compare ↓
                                        </div>
                                    </>
                                ) : `✗ ${uploadResult.message ?? "Upload failed"}`}
                            </div>
                        )}

                        {/* Uploaded dates list */}
                        {uploadedDates.length>0 && (
                            <div style={{marginTop:8,fontSize:10,color:"rgba(232,244,241,0.4)"}}>
                                Actuals available: {uploadedDates.join(", ")}
                            </div>
                        )}
                    </div>

                    {/* ── Saved forecasts list ─────────────────────────────────────── */}
                    <div style={{...S.panel,maxHeight:420,overflow:"auto"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <div style={S.lbl}>Saved Forecasts ({predictions.length})</div>
                            <button onClick={loadPredictions}
                                    style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                                        color:"rgba(232,244,241,0.4)",borderRadius:4,padding:"3px 8px",
                                        fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>
                                Refresh
                            </button>
                        </div>

                        {predLoading && (
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.3)",textAlign:"center",padding:20}}>Loading…</div>
                        )}
                        {!predLoading && predictions.length===0 && (
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.3)",textAlign:"center",padding:16,lineHeight:1.7}}>
                                No forecasts saved yet.<br/>
                                Go to the <a href="/live" style={{color:"#00d4aa"}}>Forecast page</a>,
                                upload MERIT files and run a forecast — it saves automatically.
                            </div>
                        )}

                        {predictions.map(p => {
                            const hasActuals = p.has_actuals === 1;
                            const dateMatch  = uploadedDates.includes(p.forecast_date);
                            return (
                                <div key={p.run_id} onClick={()=>handleSelectRun(p.run_id)}
                                     style={{padding:"10px 12px",borderRadius:7,cursor:"pointer",marginBottom:8,
                                         background:selectedRun===p.run_id?"rgba(0,212,170,0.08)":"rgba(255,255,255,0.025)",
                                         border:`1px solid ${selectedRun===p.run_id?"rgba(0,212,170,0.35)":"rgba(255,255,255,0.06)"}`,
                                     }}>
                                    {/* Date + badges */}
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:500,
                        color:selectedRun===p.run_id?"#00d4aa":"#e8f4f1"}}>
                      {p.forecast_date}
                    </span>
                                        <div style={{display:"flex",gap:4}}>
                                            {(hasActuals||dateMatch) && (
                                                <span style={{fontSize:8,color:"#00d4aa",background:"rgba(0,212,170,0.1)",
                                                    padding:"1px 6px",borderRadius:3}}>
                          ✓ actuals
                        </span>
                                            )}
                                            <span style={{fontSize:8,color:"rgba(232,244,241,0.3)",
                                                background:"rgba(255,255,255,0.04)",padding:"1px 6px",borderRadius:3}}>
                        {p.mode}
                      </span>
                                        </div>
                                    </div>
                                    {/* Run ID */}
                                    <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",fontFamily:"monospace",marginBottom:3}}>
                                        {p.run_id.slice(0,40)}{p.run_id.length>40?"…":""}
                                    </div>
                                    {/* Stats */}
                                    <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",display:"flex",gap:10}}>
                                        <span>Peak: {p.all_india_peak_mw?(p.all_india_peak_mw/1000).toFixed(0)+"K MW":"—"}</span>
                                        <span>·</span>
                                        <span>{p.weather_source?.slice(0,15)}</span>
                                    </div>
                                    {/* Hint if actuals needed */}
                                    {!hasActuals && !dateMatch && (
                                        <div style={{marginTop:5,fontSize:9,color:"rgba(255,179,71,0.6)"}}>
                                            ↑ Upload actual CSV for {p.forecast_date} to compare
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── RIGHT PANEL — comparison detail ──────────────────────────────── */}
                <div style={{display:"flex",flexDirection:"column",gap:14}}>

                    {/* Empty state */}
                    {!selectedRun && !cmpLoading && (
                        <div style={{...S.panel,display:"flex",alignItems:"center",justifyContent:"center",
                            minHeight:320,flexDirection:"column",gap:14}}>
                            <div style={{fontSize:40}}>⚖</div>
                            <div style={{fontSize:13,color:"rgba(232,244,241,0.5)",fontWeight:500}}>
                                Select a saved forecast to compare
                            </div>
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.35)",textAlign:"center",lineHeight:1.9,maxWidth:380}}>
                                <strong style={{color:"rgba(232,244,241,0.55)"}}>Workflow:</strong><br/>
                                1. Run a forecast on the <a href="/live" style={{color:"#00d4aa"}}>Forecast page</a> (saves automatically)<br/>
                                2. Upload the actual MERIT CSV for that date using the panel on the left<br/>
                                3. Click the forecast run — comparison loads instantly
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {cmpLoading && (
                        <div style={{...S.panel,display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
                            <div style={{fontSize:11,color:"rgba(0,212,170,0.6)",fontFamily:"monospace"}}>
                                Loading comparison…
                            </div>
                        </div>
                    )}

                    {/* No actuals yet */}
                    {selectedRun && !cmpLoading && comparison && comparison.error && (
                        <div style={{...S.panel,padding:20}}>
                            <div style={{fontSize:12,fontWeight:500,color:"#ffb347",marginBottom:8}}>
                                ⚠ No actual data for {comparison.forecast_date}
                            </div>
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.5)",lineHeight:1.8}}>
                                Upload the MERIT India CSV for <strong style={{color:"#e8f4f1"}}>{comparison.forecast_date}</strong> using the panel on the left,
                                then the comparison will load automatically.
                            </div>
                            <div style={{marginTop:12,fontSize:10,color:"rgba(232,244,241,0.35)"}}>
                                File to download: <span style={{fontFamily:"monospace",color:"rgba(0,212,170,0.6)"}}>
                  Demand_Met_Data_{comparison.forecast_date}.csv
                </span> from{" "}
                                <a href="https://npp.gov.in/dashBoard/gc-map-dashboard-meritchart"
                                   target="_blank" style={{color:"rgba(0,212,170,0.6)"}}>
                                    npp.gov.in merit chart ↗
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Comparison results */}
                    {selectedRun && !cmpLoading && comparison && !comparison.error && (
                        <>
                            {/* Summary bar */}
                            <div style={{...S.panel,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                                <div>
                                    <div style={{fontSize:12,fontWeight:500,color:"#e8f4f1"}}>
                                        Forecast: {comparison.forecast_date}
                                    </div>
                                    <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",marginTop:2,fontFamily:"monospace"}}>
                                        {comparison.run_id}
                                    </div>
                                </div>
                                {comparison.all_india_summary && (
                                    <div style={{display:"flex",gap:10,marginLeft:"auto",flexWrap:"wrap"}}>
                                        {[
                                            {label:"Predicted (MU)", value:`${comparison.all_india_summary.predicted_mu?.toFixed(0)}`, color:"#4da6ff"},
                                            {label:"Actual (MU)",    value:`${comparison.all_india_summary.actual_mu?.toFixed(0)}`,    color:"#00d4aa"},
                                            {label:"Daily MAPE",
                                                value:`${Math.abs(comparison.all_india_summary.error_pct??0).toFixed(1)}%`,
                                                color:Math.abs(comparison.all_india_summary.error_pct??0)<2?"#00d4aa":
                                                    Math.abs(comparison.all_india_summary.error_pct??0)<5?"#ffb347":"#ff4d6a"},
                                            {label:"MAE (MU)", value:`${comparison.all_india_summary.mae_mu?.toFixed(0)}`, color:"#c084fc"},
                                        ].map(m=>(
                                            <div key={m.label} style={{textAlign:"center",padding:"6px 12px",
                                                background:"rgba(255,255,255,0.03)",borderRadius:6}}>
                                                <div style={{fontFamily:"monospace",fontSize:15,fontWeight:700,color:m.color}}>
                                                    {m.value}
                                                </div>
                                                <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginTop:2}}>{m.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Error by region */}
                            {errorData.length > 0 && (
                                <div style={S.panel}>
                                    <div style={S.lbl}>Error by Region (MU) — Positive = under-predicted · Negative = over-predicted</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={errorData} margin={{top:4,right:12,left:0,bottom:0}}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                                            <XAxis dataKey="region" tick={{fill:"rgba(232,244,241,0.4)",fontSize:10}} axisLine={false} tickLine={false}/>
                                            <YAxis tick={{fill:"rgba(232,244,241,0.35)",fontSize:9}} axisLine={false} tickLine={false} width={40}/>
                                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1}/>
                                            <Tooltip contentStyle={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.2)",fontSize:10}}
                                                     formatter={(v:any,_:any,props:any)=>[
                                                         `${(v as number).toFixed(1)} MU  (MAPE ${props.payload.mape?.toFixed(1)}%)`,
                                                         props.payload.error_mu > 0 ? "Under-predicted" : "Over-predicted"
                                                     ]}/>
                                            <Bar dataKey="error_mu" radius={[3,3,0,0]}>
                                                {errorData.map((d,i)=>(
                                                    <Cell key={i} fill={d.error_mu>0?"#ff4d6a":"#00d4aa"} fillOpacity={0.85}/>
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>

                                    {/* Region metrics table */}
                                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8,marginTop:12}}>
                                        {errorData.map(d=>(
                                            <div key={d.region} style={{textAlign:"center",padding:"6px 8px",
                                                background:"rgba(255,255,255,0.025)",borderRadius:6,
                                                border:`1px solid ${d.color}20`}}>
                                                <div style={{fontSize:10,color:d.color,marginBottom:3}}>{d.region}</div>
                                                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,
                                                    color:d.mape<2?"#00d4aa":d.mape<5?"#ffb347":"#ff4d6a"}}>
                                                    {d.mape?.toFixed(1)}%
                                                </div>
                                                <div style={{fontSize:8,color:"rgba(232,244,241,0.3)",marginTop:1}}>MAPE</div>
                                                <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginTop:3,fontFamily:"monospace"}}>
                                                    {d.pred_mu?.toFixed(0)} vs {d.actual_mu?.toFixed(0)} MU
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hourly detail per region */}
                            <div style={S.panel}>
                                {/* Region tabs */}
                                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                                    {ALL_REGION_TABS.filter(r =>
                                        r.id==="ALL_INDIA"
                                            ? comparison.all_india_summary != null
                                            : comparison.regions?.[r.id]
                                    ).map(r => {
                                        const v   = r.id==="ALL_INDIA"
                                            ? comparison.all_india_summary
                                            : comparison.regions[r.id];
                                        const ok  = v?.actual_daily_mu != null ||
                                            (r.id==="ALL_INDIA" && comparison.all_india_summary?.actual_mu != null);
                                        const mape = r.id==="ALL_INDIA"
                                            ? (comparison.all_india_summary?.error_pct != null
                                                ? Math.abs(comparison.all_india_summary.error_pct) : null)
                                            : v?.mape_pct;
                                        return (
                                            <button key={r.id} onClick={()=>setSelectedReg(r.id)} style={{
                                                background:selectedReg===r.id?`${r.color}15`:"rgba(255,255,255,0.025)",
                                                border:`1px solid ${selectedReg===r.id?r.color+"50":"rgba(255,255,255,0.07)"}`,
                                                borderTop:`2px solid ${selectedReg===r.id?r.color:"transparent"}`,
                                                borderRadius:7,padding:"7px 12px",cursor:"pointer",minWidth:110,
                                            }}>
                                                <div style={{fontSize:11,fontWeight:500,
                                                    color:selectedReg===r.id?r.color:"#e8f4f1"}}>{r.label}</div>
                                                {ok ? (
                                                    <div style={{fontFamily:"monospace",fontSize:10,marginTop:2,
                                                        color:mape<2?"#00d4aa":mape<5?"#ffb347":"#ff4d6a"}}>
                                                        MAPE {mape?.toFixed(1)}%
                                                    </div>
                                                ) : (
                                                    <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",marginTop:2}}>
                                                        estimated
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {regionCmp && (
                                    <>
                                        {/* KPIs */}
                                        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:14}}>
                                            {(()=>{
                                                // Compute peak-hour error from hourly data
                                                const fc = regionCmp?.hourly_forecast ?? [];
                                                const actualMap = regionCmp?.hourly_actual ?? {};
                                                let predPeak = 0, actualPeak = 0, predPeakH = "—", actualPeakH = "—";
                                                fc.forEach((h:any) => {
                                                    if((h.predicted_mw||0) > predPeak) { predPeak=h.predicted_mw; predPeakH=h.label??`${h.hour}:00`; }
                                                });
                                                Object.entries(actualMap as any).forEach(([k,v]:any) => {
                                                    if(v > actualPeak) { actualPeak=v; actualPeakH=k; }
                                                });
                                                const peakGapMW  = actualPeak && predPeak ? actualPeak - predPeak : null;
                                                const peakErrPct = actualPeak && predPeak ? (actualPeak-predPeak)/actualPeak*100 : null;
                                                return [
                                                    {l:"Predicted (MU)",  v:regionCmp?.predicted_daily_mu?.toFixed(1),                      c:"#4da6ff"},
                                                    {l:isAllIndia?"Actual (MU)":"Actual (MU)",
                                                        v:(isAllIndia?(regionCmp as any)?.actual_mu:regionCmp?.actual_daily_mu)?.toFixed(1)??"—", c:"#00d4aa"},
                                                    {l:"Daily MAPE",
                                                        v:regionCmp?.mape_pct!=null?`${regionCmp.mape_pct.toFixed(1)}%`:"—",
                                                        c:regionCmp?.mape_pct!=null?regionCmp.mape_pct<2?"#00d4aa":regionCmp.mape_pct<5?"#ffb347":"#ff4d6a":"rgba(232,244,241,0.4)"},
                                                    {l:"Peak Gap",
                                                        v:peakGapMW!=null?`${peakGapMW>0?"+":""}${(peakGapMW/1000).toFixed(1)} GW`:"—",
                                                        c:peakGapMW!=null?Math.abs(peakGapMW)<3000?"#00d4aa":Math.abs(peakGapMW)<8000?"#ffb347":"#ff4d6a":"rgba(232,244,241,0.4)"},
                                                    {l:"Peak Error",
                                                        v:peakErrPct!=null?`${peakErrPct>0?"+":""}${peakErrPct.toFixed(1)}%`:"—",
                                                        c:peakErrPct!=null?Math.abs(peakErrPct)<2?"#00d4aa":Math.abs(peakErrPct)<5?"#ffb347":"#ff4d6a":"rgba(232,244,241,0.4)"},
                                                ].map(m=>(
                                                    <div key={m.l} style={{textAlign:"center",background:"rgba(255,255,255,0.03)",
                                                        borderRadius:6,padding:"8px"}}>
                                                        <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:m.c}}>{m.v}</div>
                                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginTop:2}}>{m.l}</div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>

                                        {/* Hourly chart */}
                                        {hourlyChart.length > 0 && (
                                            <>
                                                <div style={{...S.lbl,display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                                                    Hourly Profile — {ALL_REGION_TABS.find(r=>r.id===selectedReg)?.label}
                                                    {hasActualHourly && (
                                                        <span style={{fontSize:9,color:"#00d4aa",background:"rgba(0,212,170,0.1)",
                                                            padding:"1px 8px",borderRadius:3}}>
                              ✓ actual data overlaid
                            </span>
                                                    )}
                                                </div>
                                                <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                                                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(232,244,241,0.6)"}}>
                                                        <svg width={24} height={8}><rect x={0} y={1} width={24} height={6} fill="rgba(0,212,170,0.15)" rx={1}/><line x1={0} y1={4} x2={24} y2={4} stroke="#00d4aa" strokeWidth={2.5}/></svg>
                                                        <strong style={{color:"#00d4aa"}}>Predicted demand</strong>
                                                    </div>
                                                    {hasActualHourly && (
                                                        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(232,244,241,0.6)"}}>
                                                            <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke="#ffffff" strokeWidth={2.5} strokeDasharray="6 2"/></svg>
                                                            <strong style={{color:"#ffffff"}}>Actual demand</strong>
                                                        </div>
                                                    )}
                                                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(232,244,241,0.4)"}}>
                                                        <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3"/></svg>
                                                        Available capacity
                                                    </div>
                                                </div>
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <ComposedChart data={hourlyChart} margin={{top:4,right:12,left:0,bottom:0}}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                                                        <XAxis dataKey="label" tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} interval={3}/>
                                                        <YAxis tickFormatter={cFmt} tick={{fill:"rgba(232,244,241,0.35)",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} width={cMax>50000?44:38} domain={[cYMin,cYMax]} label={cMax>50000?{value:"GW",angle:-90,position:"insideLeft",fill:"rgba(232,244,241,0.2)",fontSize:9,dx:10}:undefined}/>
                                                        <Tooltip content={<Tip/>}/>
                                                        {/* Predicted — teal solid area */}
                                                        <Area type="monotone" dataKey="Predicted" stroke="#00d4aa" strokeWidth={2.5} fill="rgba(0,212,170,0.07)" dot={false} name="Predicted"/>
                                                        {/* Actual — bright white dashed, clearly distinct from predicted */}
                                                        {hasActualHourly && (
                                                            <Line type="monotone" dataKey="Actual" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="7 2" dot={false} connectNulls name="Actual"/>
                                                        )}
                                                        {/* Capacity — amber dotted, thinner, clearly a limit line not a demand line */}
                                                        <Line type="monotone" dataKey="Capacity" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Capacity"/>
                                                    </ComposedChart>
                                                </ResponsiveContainer>

                                                {!hasActualHourly && (
                                                    <div style={{marginTop:8,fontSize:10,color:"rgba(232,244,241,0.35)",lineHeight:1.6}}>
                                                        Upload the MERIT CSV for {comparison.forecast_date} to overlay actual hourly demand on this chart.
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Source note */}
                            <div style={{...S.panel,background:"rgba(0,212,170,0.03)",border:"1px solid rgba(0,212,170,0.1)"}}>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.45)",lineHeight:1.8}}>
                                    <strong style={{color:"rgba(0,212,170,0.7)"}}>How comparison works:</strong>
                                    {" "}Uploaded MERIT CSV → daily total (MU) computed by trapezoidal integration of 4-min readings.
                                    Regional actuals estimated from All-India total using the same dynamic hour×month load share ratios applied at forecast time
                                    (Northern ~30% · Western ~31% · Southern ~26% · Eastern ~12% · NE ~1.2% — varies by hour and month).
                                    Hourly actual overlaid on chart by splitting All-India hourly values by the same ratios.
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}