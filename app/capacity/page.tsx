"use client";

import { useEffect, useState, useCallback } from "react";

const REGIONS = [
    { id:"Northern_Region",     label:"Northern", color:"#4da6ff" },
    { id:"Western_Region",      label:"Western",  color:"#ffb347" },
    { id:"Southern_Region",     label:"Southern", color:"#00d4aa" },
    { id:"Eastern_Region",      label:"Eastern",  color:"#ff4d6a" },
    { id:"NorthEastern_Region", label:"NE",       color:"#c084fc" },
];

const SOURCES = [
    { key:"thermal", label:"Thermal",  color:"#ff6b35" },
    { key:"solar",   label:"Solar",    color:"#ffd60a" },
    { key:"wind",    label:"Wind",     color:"#4da6ff" },
    { key:"hydro",   label:"Hydro",    color:"#00d4aa" },
    { key:"nuclear", label:"Nuclear",  color:"#c084fc" },
    { key:"other",   label:"Other RE", color:"#888888" },
];

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const Tip = ({active,payload,label}:any) => {
    if (!active||!payload?.length) return null;
    return (
        <div style={{background:"#0d1821",border:"1px solid rgba(0,212,170,0.25)",borderRadius:6,padding:"9px 13px",fontSize:11}}>
            <p style={{color:"#00d4aa",marginBottom:4,fontFamily:"monospace"}}>{label}</p>
            {payload.map((p:any)=>(
                <p key={p.name} style={{color:p.color??p.fill??"#e8f4f1",margin:"2px 0"}}>
                    {p.name}: <strong>{typeof p.value==="number"?`${(p.value/1000).toFixed(1)} GW`:p.value}</strong>
                </p>
            ))}
        </div>
    );
};

async function fetchAllIndia24h(weather?: {solar:number[],temp:number[],wind:number[]}): Promise<any> {
    const params = new URLSearchParams();
    if (weather) {
        params.set("solar_wm2", weather.solar.join(","));
        params.set("temp_c",    weather.temp.join(","));
        params.set("wind_ms",   weather.wind.join(","));
    }
    const res = await fetch(`${BASE}/api/capacity/all-india-24h?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchRegion24h(region:string, weather?: {solar:number[],temp:number[],wind:number[]}): Promise<any> {
    const params = new URLSearchParams({ region });
    if (weather) {
        params.set("solar_wm2", weather.solar.join(","));
        params.set("temp_c",    weather.temp.join(","));
        params.set("wind_ms",   weather.wind.join(","));
    }
    const res = await fetch(`${BASE}/api/capacity/24h?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchWeather(): Promise<any> {
    // Use live weather endpoint to get today's weather for Delhi (representative)
    const res = await fetch(`${BASE}/api/live/weather?hours_ahead=24`);
    if (!res.ok) return null;
    return res.json();
}

async function fetchAllRegionsCurrent(): Promise<any> {
    const res = await fetch(`${BASE}/api/capacity/all-regions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export default function CapacityPage() {
    const [hourlyData, setHourlyData]     = useState<any[]>([]);
    const [allCap,     setAllCap]         = useState<any>(null);
    const [loading,    setLoading]        = useState(true);
    const [weather,    setWeather]        = useState<{solar:number[],temp:number[],wind:number[]}|null>(null);
    const [weatherUsed, setWeatherUsed]   = useState(false);
    const [selectedRegion, setRegion]     = useState("ALL_INDIA");
    const [activeHour, setActiveHour]     = useState<number|null>(null);
    const [lastRefresh, setLastRefresh]   = useState("");

    const loadWeather = async () => {
        try {
            const wx = await fetchWeather();
            if (wx?.Northern_Region && Array.isArray(wx.Northern_Region)) {
                const arr = wx.Northern_Region.slice(0, 24);
                const solar = arr.map((h:any) => h.solar_wm2 ?? 0);
                const temp  = arr.map((h:any) => h.temp_c ?? 30);
                const wind  = arr.map((h:any) => h.wind_speed_ms ?? 4);
                return { solar, temp, wind };
            }
        } catch(e) {}
        return null;
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [wxData, current] = await Promise.all([
                loadWeather(),
                fetchAllRegionsCurrent(),
            ]);
            setWeather(wxData);
            setAllCap(current);

            if (selectedRegion === "ALL_INDIA") {
                const d = await fetchAllIndia24h(wxData || undefined);
                setHourlyData(d.hours ?? []);
                setWeatherUsed(d.weather_used);
            } else {
                const d = await fetchRegion24h(selectedRegion, wxData || undefined);
                setHourlyData(d.hours ?? []);
                setWeatherUsed(d.weather_used);
            }
            setLastRefresh(new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"}));
        } catch(e) { console.error(e); }
        setLoading(false);
    }, [selectedRegion]);

    useEffect(() => { load(); }, [load]);

    const nowHour  = new Date().getHours();
    const maxTotal = Math.max(...hourlyData.map(h => h.total_available_mw), 1);
    const activeH  = activeHour != null ? hourlyData.find(h => h.hour === activeHour) : hourlyData[nowHour];

    const ai = allCap?.all_india;
    const installedTotal = 532740;
    const availableTotal = ai?.total_available_mw ?? 0;

    const S: any = {
        root:  {minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"12px 24px"},
        panel: {background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:16},
        lbl:   {fontSize:10,letterSpacing:"0.12em",color:"rgba(232,244,241,0.4)",textTransform:"uppercase" as const,marginBottom:10},
    };

    return (
        <div style={S.root}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:4}}>
                <div>
                    <div style={{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"}}>
                        ⚡ Grid Capacity — India (CEA Mar 2026)
                    </div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:2}}>
                        Hourly available capacity · weather-adjusted · 532 GW installed
                        {weatherUsed && <span style={{color:"#ffd60a",marginLeft:8}}>☀ Live weather applied</span>}
                        {lastRefresh && <span style={{marginLeft:8}}>· {lastRefresh} IST</span>}
                    </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>




                    <select value={selectedRegion} onChange={e=>setRegion(e.target.value)}
                            style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#e8f4f1",borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:"monospace"}}>
                        <option value="ALL_INDIA">🇮🇳 All India</option>
                        {REGIONS.map(r=><option key={r.id} value={r.id}>{r.label} Region</option>)}
                    </select>
                    <button onClick={load} style={{background:"transparent",border:"1px solid rgba(0,212,170,0.3)",color:"#00d4aa",borderRadius:6,padding:"4px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                        {loading?"Loading…":"↻ Refresh"}
                    </button>
                </div>
            </div>

            {/* All-India KPI row — shown only when All India selected */}
            {ai && selectedRegion === "ALL_INDIA" && (
                <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:10}}>
                        {[
                            {l:"Available Now",    v:`${(availableTotal/1000).toFixed(0)} GW`,  s:`of ${(installedTotal/1000).toFixed(0)} GW installed`, c:"#00d4aa"},
                            {l:"Thermal",          v:`${(ai.thermal_mw/1000).toFixed(0)} GW`,   s:"Base load — constant 24h",                            c:"#ff6b35"},
                            {l:"Renewable Now",    v:`${(ai.renewable_mw/1000).toFixed(0)} GW`, s:`${ai.renewable_pct}% of available`,                   c:"#ffd60a"},
                            {l:"Solar + Wind",     v:`${((ai.solar_mw??0)+(ai.wind_mw??0) > 0 ? ((ai.solar_mw??0)+(ai.wind_mw??0)) : 0)/1000 < 0.5 ? "—" : ((((ai.solar_mw??0)+(ai.wind_mw??0))/1000).toFixed(0)+" GW")}`, s:"Variable renewables this hour", c:"#4da6ff"},
                            {l:"Utilisation",      v:`${Math.round(availableTotal/installedTotal*100)}%`, s:"Available / Installed",                      c:"#c084fc"},
                        ].map(m=>(
                            <div key={m.l} style={{...S.panel,borderTop:`2px solid ${m.c}`,padding:"12px 14px"}}>
                                <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:m.c}}>{m.v}</div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.5)",marginTop:3}}>{m.l}</div>
                                <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",marginTop:2}}>{m.s}</div>
                            </div>
                        ))}
                    </div>

                    {/* Installed vs available bar */}
                    <div style={{...S.panel,marginBottom:14,padding:"12px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(232,244,241,0.4)",marginBottom:6}}>
                            <span>Installed vs Available — All India (this hour)</span>
                            <span style={{fontFamily:"monospace"}}>{(availableTotal/1000).toFixed(0)} GW available of 532 GW installed</span>
                        </div>
                        <div style={{height:20,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden",position:"relative",display:"flex"}}>
                            {SOURCES.map(s => {
                                const mw = (allCap?.all_india as any)?.[s.key+"_mw"] ?? 0;
                                const pct = mw / installedTotal * 100;
                                return pct > 0.3 ? (
                                    <div key={s.key} title={`${s.label}: ${(mw/1000).toFixed(1)} GW`}
                                         style={{height:"100%",width:`${pct}%`,background:s.color,opacity:0.85}}/>
                                ) : null;
                            })}
                            <div style={{position:"absolute",top:0,bottom:0,right:0,
                                width:`${(1-availableTotal/installedTotal)*100}%`,
                                background:"rgba(255,255,255,0.05)",borderLeft:"1px dashed rgba(255,255,255,0.15)"}}>
              <span style={{position:"absolute",left:4,top:"50%",transform:"translateY(-50%)",fontSize:8,color:"rgba(232,244,241,0.3)"}}>
                planned outage
              </span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Region cards (5 region mini-cards, always shown) */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:14}}>
                {REGIONS.map(r => {
                    const cap = allCap?.regions?.[r.id];
                    const b   = cap?.breakdown_mw ?? {};
                    const total = cap?.total_available_mw ?? 0;
                    const isSelected = selectedRegion === r.id;
                    return (
                        <div key={r.id} onClick={()=>setRegion(r.id)} style={{
                            ...S.panel, borderTop:`2px solid ${r.color}`,
                            cursor:"pointer",
                            outline:isSelected?`1px solid ${r.color}40`:undefined,
                            background:isSelected?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.025)",
                        }}>
                            <div style={{fontSize:12,fontWeight:600,color:r.color,marginBottom:4}}>{r.label}</div>
                            <div style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:"#e8f4f1",marginBottom:4}}>
                                {total>0?(total/1000).toFixed(1):"—"} GW
                            </div>
                            <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",marginBottom:6}}>available now</div>
                            {SOURCES.filter(s=>(b as any)[s.key]>0).map(s=>{
                                const mw  = (b as any)[s.key] ?? 0;
                                const pct = total>0?Math.round(mw/total*100):0;
                                return (
                                    <div key={s.key} style={{marginBottom:3}}>
                                        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(232,244,241,0.4)",marginBottom:1}}>
                                            <span>{s.label}</span>
                                            <span style={{fontFamily:"monospace"}}>{(mw/1000).toFixed(1)}</span>
                                        </div>
                                        <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2}}>
                                            <div style={{height:"100%",width:`${pct}%`,background:s.color,opacity:0.8,borderRadius:2}}/>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Main: 24h hourly chart + detail panel */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:14,marginBottom:14}}>
                <div style={S.panel}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={S.lbl}>
                            24-Hour Available Capacity — {selectedRegion==="ALL_INDIA"?"All India":REGIONS.find(r=>r.id===selectedRegion)?.label+" Region"}
                            {weatherUsed && <span style={{color:"#ffd60a",fontWeight:600}}> · Weather adjusted</span>}
                        </div>
                        <div style={{display:"flex",gap:10}}>
                            {SOURCES.map(s=>(
                                <span key={s.key} style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:8,height:8,borderRadius:2,background:s.color,display:"inline-block"}}/>
                                    {s.label}
                </span>
                            ))}
                        </div>
                    </div>

                    {/* Stacked hourly chart */}
                    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:220,marginBottom:6}}>
                        {hourlyData.map((h:any) => {
                            const isNow    = h.hour === nowHour;
                            const isActive = activeHour === h.hour;
                            const total    = h.total_available_mw || 1;
                            const b        = h.breakdown_mw ?? {};
                            return (
                                <div key={h.hour} onMouseEnter={()=>setActiveHour(h.hour)} onMouseLeave={()=>setActiveHour(null)}
                                     style={{flex:1, cursor:"pointer", height:"100%", display:"flex", flexDirection:"column-reverse",
                                         outline: isNow?"1px solid rgba(255,255,255,0.3)":isActive?"1px solid rgba(255,255,255,0.15)":undefined,
                                         borderRadius:2, opacity:(!isNow&&!isActive&&activeHour!=null)?0.65:1, transition:"opacity 0.15s"}}>
                                    {SOURCES.map(s => {
                                        const mw  = b[s.key] ?? 0;
                                        const pct = mw / maxTotal * 100;
                                        return pct > 0.2 ? (
                                            <div key={s.key} title={`${s.label}: ${(mw/1000).toFixed(1)} GW`}
                                                 style={{width:"100%",height:`${pct}%`,background:s.color,opacity:0.85,flexShrink:0}}/>
                                        ) : null;
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* X-axis */}
                    <div style={{display:"flex",gap:4}}>
                        {hourlyData.map((h:any)=>(
                            <div key={h.hour} style={{flex:1,textAlign:"center",fontSize:8,
                                color:h.hour===nowHour?"#00d4aa":activeHour===h.hour?"rgba(232,244,241,0.6)":"rgba(232,244,241,0.3)",
                                fontFamily:"monospace",fontWeight:h.hour===nowHour?700:400}}>
                                {h.hour%3===0?`${h.hour}h`:""}
                            </div>
                        ))}
                    </div>

                    {/* Weather strip (if weather used) */}
                    {weatherUsed && (
                        <div style={{marginTop:8,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:6}}>
                            <div style={{fontSize:9,color:"rgba(232,244,241,0.35)",marginBottom:4}}>☀ Solar irradiance (W/m²) — from Open-Meteo live weather</div>
                            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:30}}>
                                {hourlyData.map((h:any) => {
                                    const s = h.weather?.solar_wm2 ?? 0;
                                    const pct = Math.min(s / 1000 * 100, 100);
                                    return (
                                        <div key={h.hour} style={{flex:1,height:`${pct}%`,background:"#ffd60a",opacity:0.6,borderRadius:"1px 1px 0 0",minHeight:1}}/>
                                    );
                                })}
                            </div>
                            <div style={{display:"flex",gap:4,marginTop:2}}>
                                {hourlyData.map((h:any)=>(
                                    <div key={h.hour} style={{flex:1,textAlign:"center",fontSize:7,color:"rgba(255,215,10,0.4)",fontFamily:"monospace"}}>
                                        {h.weather?.temp_c!=null&&h.hour%3===0?`${Math.round(h.weather.temp_c)}°`:""}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Hour detail panel */}
                <div style={S.panel}>
                    {activeH ? (
                        <>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                                <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:"#00d4aa"}}>
                                    {activeH.label}
                                </div>
                                {activeH.hour === nowHour && (
                                    <div style={{fontSize:9,background:"rgba(0,212,170,0.1)",color:"#00d4aa",
                                        border:"1px solid rgba(0,212,170,0.3)",borderRadius:4,padding:"2px 8px"}}>
                                        NOW
                                    </div>
                                )}
                            </div>

                            <div style={{fontFamily:"monospace",fontSize:28,fontWeight:700,color:"#e8f4f1",marginBottom:2}}>
                                {(activeH.total_available_mw/1000).toFixed(1)} GW
                            </div>
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",marginBottom:12}}>
                                available · {activeH.renewable_pct?.toFixed(0)}% renewable
                            </div>

                            {/* Source breakdown */}
                            <div style={S.lbl}>Source breakdown</div>
                            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                                {SOURCES.map(s => {
                                    const mw  = activeH.breakdown_mw?.[s.key] ?? 0;
                                    if (mw < 10) return null;
                                    const pct = mw / activeH.total_available_mw * 100;
                                    return (
                                        <div key={s.key}>
                                            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(232,244,241,0.6)",marginBottom:2}}>
                        <span style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{width:8,height:8,borderRadius:2,background:s.color,display:"inline-block"}}/>
                            {s.label}
                        </span>
                                                <span style={{fontFamily:"monospace"}}>{(mw/1000).toFixed(1)} GW</span>
                                            </div>
                                            <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}>
                                                <div style={{height:"100%",width:`${pct}%`,background:s.color,opacity:0.8,borderRadius:3}}/>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Weather at this hour */}
                            {activeH.weather && (activeH.weather.temp_c != null || activeH.weather.solar_wm2 != null) && (
                                <>
                                    <div style={S.lbl}>Weather this hour</div>
                                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                                        {[
                                            {l:"Temp",  v:activeH.weather.temp_c!=null?`${activeH.weather.temp_c}°C`:"—",   c:"#ffb347"},
                                            {l:"Solar", v:activeH.weather.solar_wm2!=null?`${activeH.weather.solar_wm2} W/m²`:"—", c:"#ffd60a"},
                                            {l:"Wind",  v:activeH.weather.wind_ms!=null?`${activeH.weather.wind_ms} m/s`:"—",  c:"#4da6ff"},
                                        ].map(m=>(
                                            <div key={m.l} style={{background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"6px 8px",textAlign:"center"}}>
                                                <div style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:m.c}}>{m.v}</div>
                                                <div style={{fontSize:9,color:"rgba(232,244,241,0.4)"}}>{m.l}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {activeH.alerts?.length > 0 && (
                                <div style={{marginTop:10,fontSize:10,color:"#ffb347",background:"rgba(255,179,71,0.08)",
                                    borderRadius:5,padding:"6px 8px",borderLeft:"3px solid #ffb347"}}>
                                    {activeH.alerts[0]}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{height:"100%",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:8,color:"rgba(232,244,241,0.25)"}}>
                            <div style={{fontSize:32}}>👆</div>
                            <div style={{fontSize:11,fontFamily:"monospace",textAlign:"center"}}>Hover a bar to see<br/>hourly breakdown</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: source explanation */}
            <div style={{...S.panel,background:"rgba(0,212,170,0.02)"}}>
                <div style={S.lbl}>How Hourly Available Capacity Is Computed</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14}}>
                    {[
                        {icon:"🔥",color:"#ff6b35",title:"Thermal (Coal / Gas)",
                            detail:"Constant across all 24 hours — thermal is base-load. Available = installed × seasonal availability factor (78-84%). Cooler at night = marginally better condenser efficiency. No artificial night-time reduction. Source: CEA Mar 2026."},
                        {icon:"☀",color:"#ffd60a",title:"Solar",
                            detail:"Zero before 05:00 and after 19:00. Bell-curve through daylight hours peaking at 12:00. When live Open-Meteo weather is available, solar output scales with actual irradiance (W/m²) rather than a clear-sky model. Monsoon months reduced 40–55%."},
                        {icon:"💧",color:"#00d4aa",title:"Hydro · Wind · Nuclear",
                            detail:"Hydro: seasonal (May snowmelt peak for Himalayan; Oct–Nov post-monsoon). Dispatchable reservoir hydro holds back 10% for peak hours. Wind: live wind speed from Open-Meteo scales output (capacity factor ∝ v³ / rated power). Nuclear: ~80% PLF, flat 24h."},
                    ].map(s=>(
                        <div key={s.title} style={{display:"flex",gap:10,padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:6,borderLeft:`3px solid ${s.color}`}}>
                            <span style={{fontSize:18,flexShrink:0}}>{s.icon}</span>
                            <div>
                                <div style={{fontSize:11,fontWeight:500,color:s.color,marginBottom:3}}>{s.title}</div>
                                <div style={{fontSize:10,color:"rgba(232,244,241,0.5)",lineHeight:1.6}}>{s.detail}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}