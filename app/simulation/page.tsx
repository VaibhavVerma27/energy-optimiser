"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMeritDispatch } from "../../lib/api";

const MERIT_ORDER = [
    { id:"nuclear",  label:"Nuclear",       cost:1.50, co2:0.000, color:"#c084fc" },
    { id:"hydro",    label:"Hydro",          cost:0.50, co2:0.000, color:"#00d4aa" },
    { id:"solar",    label:"Solar",          cost:2.80, co2:0.000, color:"#ffd60a" },
    { id:"wind",     label:"Wind",           cost:3.20, co2:0.000, color:"#4da6ff" },
    { id:"other",    label:"Other RE",       cost:4.00, co2:0.050, color:"#888888" },
    { id:"coal_old", label:"Coal (old PPA)", cost:4.20, co2:0.820, color:"#ff6b35" },
    { id:"coal_new", label:"Coal (new PPA)", cost:6.00, co2:0.820, color:"#ff4d6a" },
    { id:"gas",      label:"Gas",            cost:7.50, co2:0.450, color:"#ffb347" },
];

function MiniBar({value, max, color}:{value:number;max:number;color:string}) {
    const pct = max > 0 ? Math.min(value/max*100,100) : 0;
    return (
        <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3}}/>
        </div>
    );
}

export default function SimulationPage() {
    const [data, setData]       = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [date, setDate]       = useState(new Date().toISOString().split("T")[0]);
    const [activeHour, setActive] = useState<number|null>(null);
    const [tab, setTab]         = useState<"cost"|"carbon"|"mix">("cost");

    const load = useCallback(async () => {
        setLoading(true);
        try { const d = await fetchMeritDispatch(date); setData(d); }
        catch(e) { console.error(e); }
        setLoading(false);
    }, [date]);

    useEffect(() => { load(); }, [load]);

    const ins   = data?.insights;
    const hours: any[] = data?.hours ?? [];
    const maxCost = Math.max(...hours.map((h:any) => h.avg_cost_rs_kwh), 0.01);
    const maxCo2  = Math.max(...hours.map((h:any) => h.co2_g_kwh), 0.01);
    const active  = activeHour != null ? hours.find((h:any) => h.hour === activeHour) : null;

    const S: any = {
        root:  {minHeight:"100vh",background:"#0a0f14",color:"#e8f4f1",fontFamily:"'Exo 2','Segoe UI',sans-serif",padding:"12px 24px"},
        panel: {background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:16},
        lbl:   {fontSize:10,letterSpacing:"0.12em",color:"rgba(232,244,241,0.4)",textTransform:"uppercase" as const,marginBottom:10},
        tabBtn: (a:boolean) => ({padding:"5px 14px",borderRadius:5,fontSize:11,fontFamily:"monospace",cursor:"pointer",border:"none",background:a?"rgba(0,212,170,0.15)":"transparent",color:a?"#00d4aa":"rgba(232,244,241,0.4)",borderBottom:a?"2px solid #00d4aa":"2px solid transparent"}),
    };

    return (
        <div style={S.root}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:4}}>
                <div>
                    <div style={{fontFamily:"monospace",fontSize:13,letterSpacing:"0.15em",color:"#00d4aa",textTransform:"uppercase"}}>
                        ⚡ Merit Order — Cost & Carbon Intensity
                    </div>
                    <div style={{fontSize:11,color:"rgba(232,244,241,0.4)",marginTop:2}}>
                        Hour-by-hour dispatch cost · carbon intensity · renewable curtailment · All India
                    </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>




                    <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                           style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#e8f4f1",borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:"monospace"}}/>
                    <button onClick={load} style={{background:"transparent",border:"1px solid rgba(0,212,170,0.3)",color:"#00d4aa",borderRadius:6,padding:"4px 12px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                        {loading?"Loading…":"↻"}
                    </button>
                </div>
            </div>

            {loading && <div style={{textAlign:"center",padding:60,color:"rgba(232,244,241,0.3)",fontFamily:"monospace"}}>Computing merit dispatch…</div>}

            {!loading && ins && <>
                {/* KPI cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:10,marginBottom:14}}>
                    {[
                        {l:"Avg Cost",       v:`₹${ins.avg_cost_rs_kwh?.toFixed(2)}/kWh`,                          s:"Weighted generation cost",                   c:"#ffd60a"},
                        {l:"Cost Range",     v:`₹${ins.cheapest_cost?.toFixed(2)} – ₹${ins.expensive_cost?.toFixed(2)}`, s:`${ins.cost_ratio}× spread today`,       c:"#ffb347"},
                        {l:"Avg CO₂",        v:`${(ins.avg_co2_kg_kwh*1000)?.toFixed(0)} g/kWh`,                  s:"Weighted carbon intensity",                   c:"#4da6ff"},
                        {l:"CO₂ Range",      v:`${(ins.cleanest_co2*1000)?.toFixed(0)}–${(ins.dirtiest_co2*1000)?.toFixed(0)} g/kWh`, s:`${ins.cleanest_hour}:00 cleanest`,  c:"#00d4aa"},
                        {l:"Avg Renewable",  v:`${ins.avg_renewable_pct?.toFixed(0)}%`,                            s:"Of generation today",                         c:"#00d4aa"},
                        {l:"Curtailment",    v:`${ins.total_curtailed_gwh?.toFixed(1)} GWh`,                       s:"Renewable wasted today",                      c:"#ff4d6a"},
                    ].map(m=>(
                        <div key={m.l} style={{...S.panel,borderTop:`2px solid ${m.c}`,padding:"11px 13px"}}>
                            <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:m.c,marginBottom:3}}>{m.v}</div>
                            <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",letterSpacing:"0.08em",textTransform:"uppercase"}}>{m.l}</div>
                            <div style={{fontSize:9,color:"rgba(232,244,241,0.3)",marginTop:2}}>{m.s}</div>
                        </div>
                    ))}
                </div>

                {/* Shift opportunity banner */}
                {ins.shift_saving_crore > 0 && (
                    <div style={{...S.panel,marginBottom:14,background:"rgba(0,212,170,0.04)",borderColor:"rgba(0,212,170,0.2)",display:"flex",alignItems:"center",gap:16}}>
                        <div style={{fontSize:22}}>💡</div>
                        <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:"#00d4aa",marginBottom:3}}>Load Shift Opportunity</div>
                            <div style={{fontSize:11,color:"rgba(232,244,241,0.6)"}}>
                                Shifting 5 GW flexible load from{" "}
                                <strong style={{color:"#ff4d6a"}}>{ins.worst_hours?.map((h:number)=>`${h}:00`).join(", ")}</strong> to{" "}
                                <strong style={{color:"#00d4aa"}}>{ins.best_hours?.map((h:number)=>`${h}:00`).join(", ")}</strong> saves{" "}
                                <strong style={{color:"#ffd60a"}}>₹{ins.shift_saving_crore} crore</strong> and reduces{" "}
                                <strong style={{color:"#4da6ff"}}>{ins.shift_co2_saving_t?.toLocaleString()} t CO₂</strong> today.
                            </div>
                        </div>
                        <div style={{textAlign:"center",padding:"8px 16px",background:"rgba(255,215,10,0.08)",borderRadius:6,border:"1px solid rgba(255,215,10,0.2)"}}>
                            <div style={{fontFamily:"monospace",fontSize:20,fontWeight:700,color:"#ffd60a"}}>₹{ins.shift_saving_crore}Cr</div>
                            <div style={{fontSize:9,color:"rgba(232,244,241,0.4)"}}>potential saving</div>
                        </div>
                    </div>
                )}

                {/* Chart + detail */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:14,marginBottom:14}}>
                    <div style={S.panel}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                            <div style={S.lbl}>24-Hour Profile</div>
                            <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                                {(["cost","carbon","mix"] as const).map(t=>(
                                    <button key={t} onClick={()=>setTab(t)} style={S.tabBtn(tab===t)}>
                                        {t==="cost"?"₹ Cost":t==="carbon"?"CO₂":t==="mix"?"⚡ Mix":""}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{display:"flex",alignItems:"flex-end",gap:3,height:200,marginBottom:6}}>
                            {hours.map((h:any) => {
                                const isActive = activeHour === h.hour;
                                const isBest   = ins.best_hours?.includes(h.hour);
                                const isWorst  = ins.worst_hours?.includes(h.hour);
                                if (tab==="cost") {
                                    const pct = h.avg_cost_rs_kwh / maxCost * 100;
                                    const col = h.avg_cost_rs_kwh < 4 ? "#00d4aa" : h.avg_cost_rs_kwh < 5.5 ? "#ffd60a" : "#ff4d6a";
                                    return (
                                        <div key={h.hour} onMouseEnter={()=>setActive(h.hour)} onMouseLeave={()=>setActive(null)}
                                             style={{flex:1,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                            <div style={{width:"100%",height:3,background:isBest?"#00d4aa":isWorst?"#ff4d6a":"transparent",borderRadius:2}}/>
                                            <div style={{width:"100%",height:`${pct}%`,background:col,opacity:isActive?1:0.75,borderRadius:"2px 2px 0 0",outline:isActive?`2px solid ${col}`:undefined,transition:"opacity 0.15s"}}/>
                                        </div>
                                    );
                                }
                                if (tab==="carbon") {
                                    const pct = h.co2_g_kwh / maxCo2 * 100;
                                    const col = h.co2_g_kwh < 250 ? "#00d4aa" : h.co2_g_kwh < 450 ? "#ffd60a" : "#ff4d6a";
                                    return (
                                        <div key={h.hour} onMouseEnter={()=>setActive(h.hour)} onMouseLeave={()=>setActive(null)}
                                             style={{flex:1,cursor:"pointer",display:"flex",alignItems:"flex-end"}}>
                                            <div style={{width:"100%",height:`${pct}%`,background:col,opacity:isActive?1:0.75,borderRadius:"2px 2px 0 0"}}/>
                                        </div>
                                    );
                                }
                                const total = h.gen_required_mw || 1;
                                return (
                                    <div key={h.hour} onMouseEnter={()=>setActive(h.hour)} onMouseLeave={()=>setActive(null)}
                                         style={{flex:1,cursor:"pointer",height:"100%",display:"flex",flexDirection:"column-reverse",opacity:isActive?1:0.8}}>
                                        {MERIT_ORDER.map(src => {
                                            const mw = h.dispatch?.[src.id] ?? 0;
                                            const pct = mw / total * 100;
                                            return pct > 0.5 ? <div key={src.id} style={{width:"100%",height:`${pct}%`,background:src.color,flexShrink:0}}/> : null;
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{display:"flex",gap:3}}>
                            {hours.map((h:any)=>(
                                <div key={h.hour} style={{flex:1,textAlign:"center",fontSize:8,color:activeHour===h.hour?"#00d4aa":"rgba(232,244,241,0.3)",fontFamily:"monospace"}}>
                                    {h.hour%3===0?`${h.hour}h`:""}
                                </div>
                            ))}
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap"}}>
                            {tab==="cost" && <>
                                <span style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:"#00d4aa",display:"inline-block"}}/>{"<₹4"}</span>
                                <span style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:"#ffd60a",display:"inline-block"}}/>₹4–5.5</span>
                                <span style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:"#ff4d6a",display:"inline-block"}}/>{">₹5.5"}</span>
                                <span style={{marginLeft:"auto",fontSize:10,color:"rgba(0,212,170,0.7)"}}>▬ Best</span>
                                <span style={{fontSize:10,color:"rgba(255,77,106,0.7)"}}>▬ Worst</span>
                            </>}
                            {tab==="carbon" && <>
                                <span style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:"#00d4aa",display:"inline-block"}}/>{"<250g"}</span>
                                <span style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:"#ffd60a",display:"inline-block"}}/>250–450g</span>
                                <span style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:"#ff4d6a",display:"inline-block"}}/>{">450g"}</span>
                            </>}
                            {tab==="mix" && MERIT_ORDER.slice(0,6).map(s=>(
                                <span key={s.id} style={{fontSize:10,color:"rgba(232,244,241,0.5)",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:8,height:8,borderRadius:2,background:s.color,display:"inline-block"}}/>{s.label}
                </span>
                            ))}
                        </div>
                    </div>

                    {/* Hour detail */}
                    <div style={S.panel}>
                        {active ? <>
                            <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:active.color,marginBottom:2}}>{active.label}</div>
                            <div style={{fontSize:10,color:"rgba(232,244,241,0.4)",marginBottom:12}}>{active.cost_label} · {active.co2_intensity_label} carbon</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                                {[
                                    {l:"Demand",   v:`${(active.demand_mw/1000).toFixed(1)} GW`, c:"#e8f4f1"},
                                    {l:"Cost",     v:`₹${active.avg_cost_rs_kwh}/kWh`,           c:"#ffd60a"},
                                    {l:"CO₂",      v:`${active.co2_g_kwh} g/kWh`,                c:"#4da6ff"},
                                    {l:"RE share", v:`${active.renewable_pct?.toFixed(0)}%`,      c:"#00d4aa"},
                                    {l:"Marginal", v:`₹${active.marginal_cost}/kWh`,             c:"#ffb347"},
                                    {l:"Curtailed",v:`${(active.curtailed_mw/1000).toFixed(1)} GW`, c:"#ff4d6a"},
                                ].map(m=>(
                                    <div key={m.l} style={{background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"6px 8px"}}>
                                        <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:m.c}}>{m.v}</div>
                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)"}}>{m.l}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={S.lbl}>Dispatch mix</div>
                            <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                {MERIT_ORDER.map(src => {
                                    const mw = active.dispatch?.[src.id] ?? 0;
                                    if (mw < 10) return null;
                                    return (
                                        <div key={src.id}>
                                            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(232,244,241,0.55)",marginBottom:2}}>
                        <span style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{width:6,height:6,borderRadius:1,background:src.color,display:"inline-block"}}/>
                            {src.label}
                        </span>
                                                <span style={{fontFamily:"monospace"}}>{(mw/1000).toFixed(1)} GW</span>
                                            </div>
                                            <MiniBar value={mw} max={active.gen_required_mw} color={src.color}/>
                                        </div>
                                    );
                                })}
                            </div>
                        </> : (
                            <div style={{height:"100%",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:10,color:"rgba(232,244,241,0.25)"}}>
                                <div style={{fontSize:32}}>👆</div>
                                <div style={{fontSize:11,fontFamily:"monospace",textAlign:"center"}}>Hover a bar to see<br/>dispatch details</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom: merit order table + explainer */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <div style={S.panel}>
                        <div style={S.lbl}>India Merit Order — Dispatch Priority (cheapest first)</div>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {MERIT_ORDER.map((s,i)=>(
                                <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"rgba(255,255,255,0.02)",borderRadius:5,borderLeft:`3px solid ${s.color}`}}>
                                    <div style={{fontFamily:"monospace",fontSize:11,color:"rgba(232,244,241,0.3)",width:14}}>{i+1}</div>
                                    <div style={{flex:1}}>
                                        <div style={{fontSize:11,fontWeight:500,color:"rgba(232,244,241,0.8)"}}>{s.label}</div>
                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.4)",marginTop:1}}>{s.co2===0?"Zero carbon":`${(s.co2*1000).toFixed(0)} g CO₂/kWh`}</div>
                                    </div>
                                    <div style={{textAlign:"right"}}>
                                        <div style={{fontFamily:"monospace",fontSize:12,color:s.color}}>₹{s.cost}/kWh</div>
                                        <div style={{fontSize:9,color:"rgba(232,244,241,0.3)"}}>variable cost</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{marginTop:10,fontSize:9,color:"rgba(232,244,241,0.3)",lineHeight:1.6}}>
                            Variable cost = what the grid pays per additional kWh. Cheapest dispatched first.<br/>
                            The last (marginal) source dispatched sets the system marginal cost.<br/>
                            Sources: MERIT India, CERC 2024-25, IISD 2025, CEA emission factor 0.477 kg/kWh.
                        </div>
                    </div>
                    <div style={S.panel}>
                        <div style={S.lbl}>Why Carbon Intensity Varies Through the Day</div>
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {[
                                {icon:"☀",color:"#ffd60a",title:"10:00–16:00 — Solar window",
                                    detail:"India's 300+ GW solar displaces coal at midday. Carbon drops to 200–300 g/kWh and cost falls to ₹3–4/kWh. Cheapest, cleanest window of the day."},
                                {icon:"🌙",color:"#4da6ff",title:"19:00–23:00 — Evening coal peak",
                                    detail:"Solar drops to zero but demand peaks. Coal fills the gap entirely. Carbon spikes to 500–650 g/kWh, cost jumps to ₹5.5–6.5/kWh — 2× midday rates."},
                                {icon:"⚡",color:"#ff4d6a",title:"43 GW sitting idle",
                                    detail:"India has 43 GW of cheap solar/wind without PPAs being curtailed while expensive coal runs. Shifting flexible loads to solar hours saves money and cuts emissions simultaneously."},
                                {icon:"📊",color:"#00d4aa",title:"T&D losses add 19.2%",
                                    detail:"Every unit consumed requires 1.23 units generated. Transmission losses mean your marginal carbon is always higher than the plant emission factor."},
                            ].map(s=>(
                                <div key={s.title} style={{display:"flex",gap:10,padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:6,borderLeft:`3px solid ${s.color}`}}>
                                    <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span>
                                    <div>
                                        <div style={{fontSize:11,fontWeight:500,color:s.color,marginBottom:2}}>{s.title}</div>
                                        <div style={{fontSize:10,color:"rgba(232,244,241,0.5)",lineHeight:1.5}}>{s.detail}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>}
        </div>
    );
}