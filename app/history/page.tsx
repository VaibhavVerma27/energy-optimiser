"use client";

import { useEffect, useState, useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function MapeChip({v}:{v:number|null}) {
    if (v == null) return <span style={{color:"rgba(232,244,241,0.3)",fontFamily:"monospace",fontSize:11}}>—</span>;
    const col = v < 2 ? "#00d4aa" : v < 5 ? "#ffd60a" : "#ff4d6a";
    return <span style={{fontFamily:"monospace",fontSize:11,color:col,fontWeight:600}}>{v.toFixed(1)}%</span>;
}

export default function HistoryPage() {
    const [runs,    setRuns]    = useState<any[]>([]);
    const [perf,    setPerf]    = useState<any>(null);
    const [detail,  setDetail]  = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [detailId,setDetailId]= useState<string|null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [deleting, setDeleting] = useState<string|null>(null);

    const deleteRun = async (run_id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete forecast ${run_id}?\nThis cannot be undone.`)) return;
        setDeleting(run_id);
        try {
            await fetch(`${BASE}/api/live/predictions/${encodeURIComponent(run_id)}`, {method:"DELETE"});
            setRuns(prev => prev.filter(r => r.run_id !== run_id));
            if (detailId === run_id) { setDetailId(null); setDetail(null); }
        } catch(e) { console.error(e); }
        setDeleting(null);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [r, p] = await Promise.all([
                fetch(`${BASE}/api/live/predictions?limit=30`).then(r=>r.json()),
                fetch(`${BASE}/api/live/rolling-performance`).then(r=>r.json()),
            ]);
            setRuns(r.predictions ?? []);
            setPerf(p);
        } catch(e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadDetail = async (run_id: string) => {
        if (detailId === run_id) { setDetailId(null); setDetail(null); return; }
        setDetailId(run_id);
        setLoadingDetail(true);
        try {
            const d = await fetch(`${BASE}/api/live/predictions/${run_id}`).then(r=>r.json());
            setDetail(d);
        } catch(e) { console.error(e); }
        setLoadingDetail(false);
    };

    const S: any = {
        root:  {minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"12px 24px"},
        panel: {background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:16},
        lbl:   {fontSize:10,letterSpacing:"0.12em",color:"rgba(232,244,241,0.4)",textTransform:"uppercase" as const,marginBottom:10},
    };

    // Build per-region hourly sparkline data from detail
    const aiHours = detail?.forecast_by_region?.["ALL_INDIA"]
        ?? detail?.forecast_by_region?.["demand_mw"]
        ?? [];
    const aiPeak  = aiHours.length ? Math.max(...aiHours.map((h:any)=>h.predicted_mw??0)) : 0;
    const aiMin   = aiHours.length ? Math.min(...aiHours.map((h:any)=>h.predicted_mw??0)) : 0;

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:4}}>
                <div>
                    <div style={{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"}}>
                        🗂 Forecast History
                    </div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:2}}>
                        All saved forecast runs · click any row to expand hourly detail
                    </div>
                </div>
                <div style={{display:"flex",gap:8}}>





                    <button onClick={load} style={{background:"transparent",border:"1px solid rgba(0,212,170,0.3)",color:"#00d4aa",borderRadius:6,padding:"4px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                        {loading?"…":"↻"}
                    </button>
                </div>
            </div>

            {/* Rolling performance strip */}
            {perf && (
                <div style={{...S.panel,marginBottom:14,display:"flex",gap:24,alignItems:"center"}}>
                    <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                        30-Day Rolling Accuracy
                    </div>
                    {perf.samples === 0 ? (
                        <div style={{fontSize:11,color:"rgba(232,244,241,0.35)"}}>
                            No actuals uploaded yet — use the Compare page to upload actual demand CSVs and build accuracy history.
                        </div>
                    ) : (
                        <>
                            {[
                                {l:"Samples",   v:perf.samples,                                   c:"#e8f4f1"},
                                {l:"MAE",       v:perf.mae_mu!=null?`${perf.mae_mu} MU`:"—",       c:"#00d4aa"},
                                {l:"Best day",  v:perf.min_error!=null?`${perf.min_error} MU`:"—", c:"#00d4aa"},
                                {l:"Worst day", v:perf.max_error!=null?`${perf.max_error} MU`:"—", c:"#ff4d6a"},
                            ].map(m=>(
                                <div key={m.l} style={{textAlign:"center"}}>
                                    <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:m.c}}>{m.v}</div>
                                    <div style={{fontSize:9,color:"rgba(232,244,241,0.4)"}}>{m.l}</div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {loading && (
                <div style={{textAlign:"center",padding:60,color:"rgba(232,244,241,0.3)",fontFamily:"monospace"}}>
                    Loading forecasts…
                </div>
            )}

            {!loading && runs.length === 0 && (
                <div style={{...S.panel,textAlign:"center",padding:"48px 24px"}}>
                    <div style={{fontSize:28,marginBottom:12}}>📭</div>
                    <div style={{fontSize:13,color:"rgba(232,244,241,0.6)",marginBottom:8}}>No forecasts saved yet</div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.35)",marginBottom:20}}>
                        Run a forecast from the Live Forecast page to populate this history.
                    </div>
                    <a href="/live" style={{display:"inline-block",padding:"8px 20px",background:"rgba(0,212,170,0.1)",
                        border:"1px solid rgba(0,212,170,0.3)",color:"#00d4aa",borderRadius:6,
                        fontFamily:"monospace",fontSize:11,textDecoration:"none"}}>
                        ⚡ Go to Forecast →
                    </a>
                </div>
            )}

            {!loading && runs.length > 0 && (
                <div style={S.panel}>
                    <div style={S.lbl}>{runs.length} saved forecast{runs.length!==1?"s":""}</div>

                    {/* Table header */}
                    <div style={{display:"grid",gridTemplateColumns:"160px 100px 80px 100px 80px 90px 1fr 60px",
                        gap:8,padding:"6px 12px",fontSize:9,letterSpacing:"0.1em",
                        color:"rgba(232,244,241,0.35)",textTransform:"uppercase",
                        borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:4}}>
                        <span>Run ID</span>
                        <span>Date</span>
                        <span>Mode</span>
                        <span>AI Peak</span>
                        <span>Has Actuals</span>
                        <span>Weather</span>
                        <span>Actions</span>
                        <span>Delete</span>
                    </div>

                    {/* Rows */}
                    {runs.map((run:any) => {
                        const isOpen = detailId === run.run_id;
                        return (
                            <div key={run.run_id}>
                                <div
                                    onClick={() => loadDetail(run.run_id)}
                                    style={{display:"grid",gridTemplateColumns:"160px 100px 80px 100px 80px 90px 1fr 60px",
                                        gap:8,padding:"9px 12px",cursor:"pointer",borderRadius:6,
                                        background:isOpen?"rgba(0,212,170,0.05)":"transparent",
                                        borderLeft:isOpen?"3px solid #00d4aa":"3px solid transparent",
                                        transition:"background 0.15s"}}
                                    onMouseEnter={e=>{ if(!isOpen)(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)"; }}
                                    onMouseLeave={e=>{ if(!isOpen)(e.currentTarget as HTMLElement).style.background="transparent"; }}>
                  <span style={{fontFamily:"monospace",fontSize:10,color:"rgba(232,244,241,0.6)",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {run.run_id}
                  </span>
                                    <span style={{fontFamily:"monospace",fontSize:11,color:"#e8f4f1"}}>
                    {run.forecast_date}
                  </span>
                                    <span style={{fontSize:10}}>
                    <span style={{padding:"2px 6px",borderRadius:3,fontSize:9,
                        background:run.mode==="live"?"rgba(0,212,170,0.1)":"rgba(77,166,255,0.1)",
                        color:run.mode==="live"?"#00d4aa":"#4da6ff",
                        border:`1px solid ${run.mode==="live"?"rgba(0,212,170,0.2)":"rgba(77,166,255,0.2)"}`}}>
                      {run.mode ?? "—"}
                    </span>
                  </span>
                                    <span style={{fontFamily:"monospace",fontSize:12,color:"#e8f4f1",fontWeight:600}}>
                    {run.all_india_peak_mw ? `${(run.all_india_peak_mw/1000).toFixed(1)} GW` : "—"}
                  </span>
                                    <span>
                    {run.has_actuals
                        ? <span style={{color:"#00d4aa",fontSize:11}}>✓ yes</span>
                        : <span style={{color:"rgba(232,244,241,0.3)",fontSize:11}}>—</span>}
                  </span>
                                    <span style={{fontSize:10,color:"rgba(232,244,241,0.5)"}}>
                    {run.weather_source ?? "—"}
                  </span>
                                    <span style={{display:"flex",gap:8,alignItems:"center"}}>
                    <a href={`/compare?run_id=${run.run_id}`}
                       onClick={e=>e.stopPropagation()}
                       style={{padding:"2px 8px",background:"rgba(77,166,255,0.08)",
                           border:"1px solid rgba(77,166,255,0.2)",color:"#4da6ff",
                           borderRadius:4,fontSize:9,fontFamily:"monospace",textDecoration:"none"}}>
                      Compare
                    </a>
                    <span style={{fontSize:10,color:"rgba(232,244,241,0.3)"}}>
                      {isOpen ? "▲ hide" : "▼ expand"}
                    </span>
                  </span>
                                    <span>
                    <button
                        onClick={e => deleteRun(run.run_id, e)}
                        disabled={deleting === run.run_id}
                        title="Delete this forecast"
                        style={{background:"transparent",border:"1px solid rgba(255,77,106,0.3)",
                            color:deleting===run.run_id?"rgba(232,244,241,0.3)":"#ff4d6a",
                            borderRadius:4,padding:"2px 8px",fontFamily:"monospace",fontSize:10,
                            cursor:deleting===run.run_id?"not-allowed":"pointer",
                            transition:"background 0.15s"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,77,106,0.1)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      {deleting===run.run_id ? "…" : "🗑"}
                    </button>
                  </span>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                    <div style={{margin:"0 0 8px 12px",padding:"12px 16px",
                                        background:"rgba(0,212,170,0.03)",border:"1px solid rgba(0,212,170,0.1)",
                                        borderRadius:"0 0 6px 6px"}}>
                                        {loadingDetail && (
                                            <div style={{color:"rgba(232,244,241,0.4)",fontFamily:"monospace",fontSize:11}}>
                                                Loading detail…
                                            </div>
                                        )}
                                        {detail && !loadingDetail && (
                                            <>
                                                {/* Meta row */}
                                                <div style={{display:"flex",gap:20,marginBottom:12,flexWrap:"wrap"}}>
                                                    {[
                                                        {l:"Run ID",      v:detail.run_id,          c:"rgba(232,244,241,0.6)"},
                                                        {l:"Forecast date",v:detail.forecast_date,  c:"#e8f4f1"},
                                                        {l:"Created at",  v:detail.created_at?.slice(0,16)?.replace("T"," "), c:"rgba(232,244,241,0.5)"},
                                                        {l:"Mode",        v:detail.mode,            c:detail.mode==="live"?"#00d4aa":"#4da6ff"},
                                                        {l:"Weather",     v:detail.weather_source,  c:"rgba(232,244,241,0.5)"},
                                                        {l:"Features",    v:detail.model_features,  c:"rgba(232,244,241,0.4)"},
                                                    ].map(m => m.v ? (
                                                        <div key={m.l}>
                                                            <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",marginBottom:2}}>{m.l}</div>
                                                            <div style={{fontFamily:"monospace",fontSize:11,color:m.c}}>{m.v}</div>
                                                        </div>
                                                    ) : null)}
                                                </div>

                                                {/* All-India hourly sparkline */}
                                                {aiHours.length > 0 && (
                                                    <>
                                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",letterSpacing:"0.1em",
                                                            textTransform:"uppercase",marginBottom:6}}>
                                                            All-India 24h predicted demand
                                                        </div>
                                                        <div style={{display:"flex",alignItems:"flex-end",gap:3,height:60,marginBottom:4}}>
                                                            {aiHours.map((h:any) => {
                                                                const mw  = h.predicted_mw ?? 0;
                                                                const pct = aiPeak > aiMin ? (mw - aiMin) / (aiPeak - aiMin) * 100 : 50;
                                                                const col = h.is_overload ? "#ff4d6a" : "#00d4aa";
                                                                return (
                                                                    <div key={h.hour} title={`${h.hour}:00 → ${(mw/1000).toFixed(1)} GW`}
                                                                         style={{flex:1,height:`${Math.max(pct,5)}%`,background:col,
                                                                             opacity:0.75,borderRadius:"1px 1px 0 0"}}>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,
                                                            color:"rgba(232,244,241,0.3)",fontFamily:"monospace",marginBottom:10}}>
                                                            <span>00:00</span>
                                                            <span>Peak: {(aiPeak/1000).toFixed(1)} GW</span>
                                                            <span>23:00</span>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Region summary table */}
                                                {Object.keys(detail.forecast_by_region ?? {}).length > 0 && (
                                                    <>
                                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",letterSpacing:"0.1em",
                                                            textTransform:"uppercase",marginBottom:6}}>
                                                            Regions in this forecast
                                                        </div>
                                                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                                            {Object.entries(detail.forecast_by_region).map(([region, hours]:any) => {
                                                                const peakMw = hours.length ? Math.max(...hours.map((h:any)=>h.predicted_mw??0)) : 0;
                                                                const overloads = hours.filter((h:any)=>h.is_overload).length;
                                                                return (
                                                                    <div key={region} style={{padding:"6px 10px",background:"rgba(255,255,255,0.03)",
                                                                        borderRadius:5,border:"1px solid rgba(255,255,255,0.06)"}}>
                                                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginBottom:2}}>
                                                                            {region.replace("_Region","").replace("_mw","").replace("demand","All-India")}
                                                                        </div>
                                                                        <div style={{fontFamily:"monospace",fontSize:12,color:"#e8f4f1"}}>
                                                                            {peakMw>0?(peakMw/1000).toFixed(1)+" GW":"—"}
                                                                        </div>
                                                                        {overloads > 0 && (
                                                                            <div style={{fontSize:9,color:"#ff4d6a",marginTop:2}}>
                                                                                ⚠ {overloads}h overload
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}