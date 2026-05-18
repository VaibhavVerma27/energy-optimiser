"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PAGES = [
    {
        href:"/live",
        icon:"⚡",
        title:"Live Forecast",
        desc:"Upload MERIT India CSVs and run a 24-hour demand forecast for all 5 regions. See predicted demand, confidence intervals, and capacity headroom.",
        color:"#00d4aa",
        cta:"Run Forecast →",
    },
    {
        href:"/compare",
        icon:"⚖",
        title:"Compare vs Actual",
        desc:"Upload actual demand data for any past date and compare against saved forecasts. View MAPE, peak error, and hourly accuracy charts.",
        color:"#4da6ff",
        cta:"Compare →",
    },
    {
        href:"/capacity",
        icon:"🔋",
        title:"Grid Capacity",
        desc:"24-hour available capacity by source — solar, wind, hydro, thermal, nuclear. Weather-adjusted using live Open-Meteo data. CEA March 2026 figures.",
        color:"#ffb347",
        cta:"View Capacity →",
    },
    {
        href:"/simulation",
        icon:"📊",
        title:"Merit Order",
        desc:"Hour-by-hour dispatch cost (₹/kWh) and carbon intensity (g CO₂/kWh). See when electricity is cheap and clean vs expensive and dirty.",
        color:"#ffd60a",
        cta:"Explore →",
    },
    {
        href:"/history",
        icon:"🗂",
        title:"Forecast History",
        desc:"All saved forecasts with peak predictions and accuracy metrics. Select any run to view or compare.",
        color:"#c084fc",
        cta:"View History →",
    },
];

const REGIONS = [
    {id:"Northern_Region",    label:"Northern", short:"NR",  color:"#4da6ff"},
    {id:"Western_Region",     label:"Western",  short:"WR",  color:"#ffb347"},
    {id:"Southern_Region",    label:"Southern", short:"SR",  color:"#00d4aa"},
    {id:"Eastern_Region",     label:"Eastern",  short:"ER",  color:"#ff4d6a"},
    {id:"NorthEastern_Region",label:"NE",       short:"NER", color:"#c084fc"},
];

export default function LandingPage() {
    const [status, setStatus]   = useState<any>(null);
    const [allCap, setAllCap]   = useState<any>(null);
    const [lastRun, setLastRun] = useState<any>(null);

    useEffect(() => {
        // Fetch model status
        fetch(`${BASE}/api/status/models`).then(r=>r.json()).then(setStatus).catch(()=>{});
        // Fetch current capacity
        fetch(`${BASE}/api/capacity/all-regions`).then(r=>r.json()).then(setAllCap).catch(()=>{});
        // Fetch last saved forecast
        fetch(`${BASE}/api/live/saved-forecasts?limit=1`).then(r=>r.json()).then(d=>{
            if (Array.isArray(d) && d.length) setLastRun(d[0]);
            else if (d?.forecasts?.length) setLastRun(d.forecasts[0]);
        }).catch(()=>{});
    }, []);

    const modelsReady   = status ? Object.values(status.models ?? {}).every(Boolean) : null;
    const ai            = allCap?.all_india;
    const installedGW   = 532.7;
    const availableGW   = ai ? +(ai.total_available_mw/1000).toFixed(0) : null;

    const S: any = {
        root: {minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",
            fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"16px 32px"},
    };

    return (
        <div style={S.root}>
            {/* Hero */}
            <div style={{textAlign:"center",marginBottom:48}}>
                <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",
                    color:"rgba(0,212,170,0.7)",textTransform:"uppercase",marginBottom:12}}>
                    AI-Based Smart Grid
                </div>
                <h1 style={{fontSize:36,fontWeight:700,color:"#e8f4f1",margin:"0 0 12px",
                    letterSpacing:"-0.5px"}}>
                    India Electricity Demand Forecasting
                </h1>
                <p style={{fontSize:14,color:"rgba(232,244,241,0.5)",maxWidth:560,
                    margin:"0 auto 28px",lineHeight:1.7}}>
                    24-hour ahead demand prediction for all 5 regional grids ·
                    Dynamic capacity engine · Merit order dispatch ·
                    Carbon &amp; cost intensity — powered by LightGBM + real MERIT India data
                </p>

                {/* Status pills */}
                <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
                    <div style={{padding:"5px 14px",borderRadius:20,fontSize:11,fontFamily:"monospace",
                        background:modelsReady===null?"rgba(255,255,255,0.05)":modelsReady?"rgba(0,212,170,0.12)":"rgba(255,179,71,0.12)",
                        border:`1px solid ${modelsReady===null?"rgba(255,255,255,0.1)":modelsReady?"rgba(0,212,170,0.3)":"rgba(255,179,71,0.3)"}`,
                        color:modelsReady===null?"rgba(232,244,241,0.4)":modelsReady?"#00d4aa":"#ffb347"}}>
                        {modelsReady===null?"Checking models…":modelsReady?"✓ 6 models ready":"⚠ Models not trained"}
                    </div>
                    {availableGW && (
                        <div style={{padding:"5px 14px",borderRadius:20,fontSize:11,fontFamily:"monospace",
                            background:"rgba(0,212,170,0.08)",border:"1px solid rgba(0,212,170,0.2)",color:"#00d4aa"}}>
                            ⚡ {availableGW} GW available now of {installedGW} GW installed
                        </div>
                    )}
                    {lastRun && (
                        <div style={{padding:"5px 14px",borderRadius:20,fontSize:11,fontFamily:"monospace",
                            background:"rgba(77,166,255,0.08)",border:"1px solid rgba(77,166,255,0.2)",color:"#4da6ff"}}>
                            Last forecast: {lastRun.forecast_date}
                        </div>
                    )}
                </div>
            </div>

            {/* Page cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:14,marginBottom:40}}>
                {PAGES.map(p=>(
                    <a key={p.href} href={p.href} style={{textDecoration:"none"}}>
                        <div style={{
                            height:"100%",
                            background:"rgba(255,255,255,0.025)",
                            border:`1px solid rgba(255,255,255,0.07)`,
                            borderTop:`3px solid ${p.color}`,
                            borderRadius:10,padding:"20px 18px",
                            cursor:"pointer",transition:"background 0.2s",
                        }}
                             onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.045)")}
                             onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.025)")}>
                            <div style={{fontSize:26,marginBottom:10}}>{p.icon}</div>
                            <div style={{fontSize:13,fontWeight:600,color:"#e8f4f1",marginBottom:8}}>{p.title}</div>
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.5)",lineHeight:1.6,marginBottom:16}}>{p.desc}</div>
                            <div style={{fontFamily:"monospace",fontSize:11,color:p.color}}>{p.cta}</div>
                        </div>
                    </a>
                ))}
            </div>

            {/* Regional capacity strip */}
            {allCap?.regions && (
                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",
                    borderRadius:10,padding:"12px 24px",marginBottom:32}}>
                    <div style={{fontSize:10,letterSpacing:"0.12em",color:"rgba(232,244,241,0.4)",
                        textTransform:"uppercase",marginBottom:14}}>
                        Regional Grid Status — Available Capacity Now
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12}}>
                        {REGIONS.map(r=>{
                            const cap = allCap.regions?.[r.id];
                            const avail = cap?.total_available_mw ?? 0;
                            const b = cap?.breakdown_mw ?? {};
                            return (
                                <div key={r.id} style={{borderLeft:`3px solid ${r.color}`,paddingLeft:10}}>
                                    <div style={{fontSize:11,color:r.color,fontWeight:600,marginBottom:2}}>{r.label}</div>
                                    <div style={{fontFamily:"monospace",fontSize:18,fontWeight:700,
                                        color:"#e8f4f1",marginBottom:4}}>
                                        {avail>0?(avail/1000).toFixed(1):"—"} GW
                                    </div>
                                    {/* Source mini-bar */}
                                    <div style={{height:4,display:"flex",borderRadius:2,overflow:"hidden",gap:0.5}}>
                                        {(["thermal","solar","wind","hydro","nuclear","other"] as const).map(s=>{
                                            const mw = (b as any)[s]??0;
                                            const pct = avail>0?mw/avail*100:0;
                                            const col = {thermal:"#ff6b35",solar:"#ffd60a",wind:"#4da6ff",
                                                hydro:"#00d4aa",nuclear:"#c084fc",other:"#888"}[s];
                                            return pct>1?<div key={s} style={{width:`${pct}%`,background:col,opacity:0.85}}/>:null;
                                        })}
                                    </div>
                                    <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",marginTop:3}}>
                                        {Object.entries(b as any).filter(([,v])=>(v as number)>500)
                                            .map(([k,v])=>`${k} ${((v as number)/1000).toFixed(0)}GW`).join(" · ")}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Model not trained warning */}
            {modelsReady === false && (
                <div style={{background:"rgba(255,179,71,0.06)",border:"1px solid rgba(255,179,71,0.25)",
                    borderRadius:8,padding:"16px 20px",marginBottom:24}}>
                    <div style={{fontSize:12,fontWeight:500,color:"#ffb347",marginBottom:8}}>⚠ Models not trained yet</div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.6)",fontFamily:"monospace"}}>
                        cd app &nbsp;&&nbsp; python train.py --data data/demand.csv
                    </div>
                    <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",marginTop:6}}>
                        Training takes ~3 minutes. Trains LightGBM for all 5 regions + All-India.
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:10,color:"rgba(232,244,241,0.25)"}}>
                    Data: POSOCO 2017–2022 · MERIT India · Open-Meteo · CEA March 2026 · CERC 2024–25
                </div>
                <div style={{fontSize:10,color:"rgba(232,244,241,0.25)",fontFamily:"monospace"}}>
                    532,740 MW installed · 5 regional grids · LightGBM + 33 features
                </div>
            </div>
        </div>
    );
}