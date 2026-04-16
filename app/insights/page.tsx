"use client";

import { useState } from "react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
    CartesianGrid, ScatterChart, Scatter, Line, ComposedChart,
    Area, ReferenceLine, Cell,
} from "recharts";

// ── Mock Data (replace with real API call after training) ─────────────────────

const FEATURE_IMPORTANCES = [
    { feature: "lag_24h",         importance: 0.241, label: "Demand t-24h" },
    { feature: "lag_48h",         importance: 0.187, label: "Demand t-48h" },
    { feature: "rolling_7d_mean", importance: 0.143, label: "7-day avg" },
    { feature: "lag_1h",          importance: 0.118, label: "Demand t-1h" },
    { feature: "rolling_7d_max",  importance: 0.092, label: "7-day peak" },
    { feature: "hour_sin",        importance: 0.071, label: "Hour (sin)" },
    { feature: "hour_cos",        importance: 0.058, label: "Hour (cos)" },
    { feature: "lag_72h",         importance: 0.039, label: "Demand t-72h" },
    { feature: "lag_2h",          importance: 0.026, label: "Demand t-2h" },
    { feature: "is_weekend",      importance: 0.018, label: "Weekend flag" },
    { feature: "lag_3h",          importance: 0.007, label: "Demand t-3h" },
];

const MODEL_COMPARISON = [
    { metric: "MAE (MW)",  rf: 182, lr: 431 },
    { metric: "RMSE (MW)", rf: 241, lr: 589 },
    { metric: "R² Score",  rf: 0.94, lr: 0.71 },
    { metric: "Accuracy",  rf: 96.2, lr: 88.4 },
];

// Generate realistic residuals data
const generateResiduals = () => {
    const actual    = [28156,26943,25891,25102,24687,25341,27892,31204,34521,37845,39201,40123,41205,42301,43102,42890,41234,39201,36541,33201,30541,28901,27201,26102];
    const predicted = [27890,27201,25601,25401,24901,25890,28012,30941,34102,37501,39502,40401,40891,42101,43401,42601,41501,39501,36201,33501,30201,29101,27501,25891];
    return actual.map((a, i) => ({
        hour: i,
        label: `${String(i).padStart(2,"0")}:00`,
        actual: a,
        predicted: predicted[i],
        residual: a - predicted[i],
        absError: Math.abs(a - predicted[i]),
    }));
};

const RESIDUALS = generateResiduals();

// Generate learning curve mock data
const LEARNING_CURVE = Array.from({ length: 10 }, (_, i) => ({
    pct: (i + 1) * 10,
    train_error: Math.round(120 + 300 * Math.exp(-i * 0.5)),
    val_error: Math.round(180 + 400 * Math.exp(-i * 0.45)),
}));

// ── Components ────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#0d1821", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 6, padding: "10px 14px", fontSize: 11 }}>
            <p style={{ color: "#00d4aa", marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color ?? "#e8f4f1", margin: "2px 0" }}>
                    {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
                </p>
            ))}
        </div>
    );
};

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
    return (
        <a href={href} style={{
            fontFamily: "monospace", fontSize: 10, letterSpacing: "0.08em",
            textDecoration: "none", padding: "4px 12px", borderRadius: 5,
            background: active ? "rgba(0,212,170,0.12)" : "transparent",
            color: active ? "#00d4aa" : "rgba(232,244,241,0.4)",
            border: active ? "1px solid rgba(0,212,170,0.25)" : "1px solid transparent",
        }}>{label}</a>
    );
}

function MetricBadge({ label, rf, lr, higherBetter = false }: { label: string; rf: number; lr: number; higherBetter?: boolean }) {
    const rfBetter = higherBetter ? rf >= lr : rf <= lr;
    return (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "rgba(232,244,241,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <div style={{ fontSize: 9, color: "rgba(232,244,241,0.4)", marginBottom: 3 }}>Random Forest</div>
                    <div style={{ fontFamily: "monospace", fontSize: 22, color: rfBetter ? "#00d4aa" : "#e8f4f1" }}>{rf}</div>
                </div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.1)" }}>vs</div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "rgba(232,244,241,0.4)", marginBottom: 3 }}>Linear Regression</div>
                    <div style={{ fontFamily: "monospace", fontSize: 22, color: !rfBetter ? "#00d4aa" : "#ff4d6a" }}>{lr}</div>
                </div>
            </div>
            <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${rfBetter ? (higherBetter ? rf : (1 - rf / (rf + lr)) * 100) : 40}%`, background: "#00d4aa", borderRadius: 2, transition: "width 0.6s" }} />
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InsightsPage() {
    const [activeModel, setActiveModel] = useState<"rf" | "lr">("rf");

    const S: Record<string, React.CSSProperties> = {
        root: { minHeight: "100vh", background: "#0a0f14", color: "#e8f4f1", fontFamily: "'Exo 2','Segoe UI',sans-serif", padding: "20px 24px" },
        header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" },
        title: { fontFamily: "monospace", fontSize: 13, letterSpacing: "0.15em", color: "#00d4aa", textTransform: "uppercase" },
        panel: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: 16 },
        panelTitle: { fontSize: 10, letterSpacing: "0.12em", color: "rgba(232,244,241,0.45)", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 },
        twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
        threeCol: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 },
        dot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
    };

    const maxImportance = Math.max(...FEATURE_IMPORTANCES.map(f => f.importance));
    const mae = RESIDUALS.reduce((s, r) => s + r.absError, 0) / RESIDUALS.length;
    const rmse = Math.sqrt(RESIDUALS.reduce((s, r) => s + r.residual ** 2, 0) / RESIDUALS.length);

    return (
        <div style={S.root}>

            {/* Header */}
            <div style={S.header}>
                <div>
                    <div style={S.title}>🧠 ML Model Insights</div>
                    <div style={{ fontSize: 11, color: "rgba(232,244,241,0.4)", marginTop: 3, fontFamily: "monospace" }}>
                        Feature importance · forecast accuracy · model comparison
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <NavLink href="/" label="Dashboard" />
                    <NavLink href="/simulation" label="Simulator" />
                    <NavLink href="/insights" label="ML Insights" active />
                    <NavLink href="/history" label="History" />
                </div>
            </div>

            {/* Model comparison cards */}
            <div style={S.threeCol}>
                <MetricBadge label="MAE (MW) ↓ better"  rf={182}  lr={431}  />
                <MetricBadge label="RMSE (MW) ↓ better" rf={241}  lr={589}  />
                <MetricBadge label="R² Score ↑ better"  rf={0.94} lr={0.71} higherBetter />
                <MetricBadge label="Accuracy % ↑ better" rf={96.2} lr={88.4} higherBetter />
            </div>

            <div style={S.twoCol}>

                {/* Feature Importance */}
                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#00d4aa" }} /> Feature Importance — Random Forest
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {FEATURE_IMPORTANCES.map((f, i) => (
                            <div key={f.feature}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, color: i < 3 ? "#e8f4f1" : "rgba(232,244,241,0.6)" }}>{f.label}</span>
                                    <span style={{ fontFamily: "monospace", fontSize: 11, color: i < 3 ? "#00d4aa" : "rgba(232,244,241,0.4)" }}>{(f.importance * 100).toFixed(1)}%</span>
                                </div>
                                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%",
                                        width: `${(f.importance / maxImportance) * 100}%`,
                                        background: i === 0 ? "#00d4aa" : i === 1 ? "#4da6ff" : i === 2 ? "#ffb347" : "rgba(0,212,170,0.4)",
                                        borderRadius: 3,
                                        transition: "width 0.6s",
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(0,212,170,0.05)", borderRadius: 6, border: "1px solid rgba(0,212,170,0.15)" }}>
                        <div style={{ fontSize: 11, color: "rgba(232,244,241,0.6)", lineHeight: 1.6 }}>
                            <strong style={{ color: "#00d4aa" }}>Key insight:</strong> Yesterday's demand (lag_24h) is the single strongest predictor at 24.1%, confirming strong daily seasonality in the grid. The 7-day rolling average captures weekly patterns. Hour encoding (sin/cos) captures intraday peaks.
                        </div>
                    </div>
                </div>

                {/* Predicted vs Actual scatter */}
                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#4da6ff" }} /> Predicted vs Actual Demand (Test Set)
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="actual" name="Actual" tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} label={{ value: "Actual MW", fill: "rgba(232,244,241,0.3)", fontSize: 10, position: "insideBottom", offset: -2 }} />
                            <YAxis dataKey="predicted" name="Predicted" tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={36} />
                            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }: any) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                return (
                                    <div style={{ background: "#0d1821", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                                        <p style={{ color: "#00d4aa", fontFamily: "monospace" }}>{d.label}</p>
                                        <p style={{ color: "#4da6ff" }}>Actual: {d.actual.toLocaleString()} MW</p>
                                        <p style={{ color: "#ffb347" }}>Predicted: {d.predicted.toLocaleString()} MW</p>
                                        <p style={{ color: d.residual > 0 ? "#ff4d6a" : "#00d4aa" }}>Error: {d.residual > 0 ? "+" : ""}{d.residual.toLocaleString()} MW</p>
                                    </div>
                                );
                            }} />
                            <Scatter data={RESIDUALS} fill="#4da6ff" fillOpacity={0.7} />
                        </ScatterChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "rgba(232,244,241,0.4)" }}>
                        <span>MAE: <strong style={{ color: "#00d4aa" }}>{Math.round(mae)} MW</strong></span>
                        <span>RMSE: <strong style={{ color: "#4da6ff" }}>{Math.round(rmse)} MW</strong></span>
                        <span style={{ marginLeft: "auto" }}>Points closer to diagonal = better predictions</span>
                    </div>
                </div>
            </div>

            <div style={S.twoCol}>

                {/* Residuals over time */}
                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#ffb347" }} /> Forecast Residuals (Predicted − Actual)
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={RESIDUALS} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={3} />
                            <YAxis tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                            <Bar dataKey="residual" name="Residual (MW)" radius={[2, 2, 0, 0]}>
                                {RESIDUALS.map((r, i) => <Cell key={i} fill={r.residual > 0 ? "#ff4d6a" : "#00d4aa"} fillOpacity={0.7} />)}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(255,179,71,0.05)", borderRadius: 6, border: "1px solid rgba(255,179,71,0.15)", fontSize: 11, color: "rgba(232,244,241,0.6)", lineHeight: 1.6 }}>
                        <strong style={{ color: "#ffb347" }}>Reading this:</strong> Red bars = model over-predicted, teal bars = under-predicted. Randomly scattered bars (no pattern) means the model has learned the data well and isn't systematically biased.
                    </div>
                </div>

                {/* Learning curve */}
                <div style={S.panel}>
                    <div style={S.panelTitle}>
                        <span style={{ ...S.dot, background: "#ff4d6a" }} /> Learning Curve — Training vs Validation Error
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={LEARNING_CURVE} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="pct" tickFormatter={(v: number) => `${v}%`} tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} label={{ value: "Training data used", fill: "rgba(232,244,241,0.3)", fontSize: 10, position: "insideBottom", offset: -2 }} />
                            <YAxis tick={{ fill: "rgba(232,244,241,0.35)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={40} label={{ value: "MAE (MW)", fill: "rgba(232,244,241,0.3)", fontSize: 10, angle: -90, position: "insideLeft" }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="train_error" name="Training error" stroke="#4da6ff" fill="rgba(77,166,255,0.1)" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="val_error"   name="Validation error" stroke="#ffb347" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        {[{ color: "#4da6ff", label: "Training error" }, { color: "#ffb347", label: "Validation error", dashed: true }].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(232,244,241,0.5)" }}>
                                <div style={{ width: 16, height: 2, background: l.color, borderTop: l.dashed ? "2px dashed" : undefined }} />{l.label}
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(77,166,255,0.05)", borderRadius: 6, border: "1px solid rgba(77,166,255,0.15)", fontSize: 11, color: "rgba(232,244,241,0.6)", lineHeight: 1.6 }}>
                        <strong style={{ color: "#4da6ff" }}>Reading this:</strong> Converging curves indicate the model generalises well. A large gap would indicate overfitting. Both errors decreasing confirms more data always helps.
                    </div>
                </div>
            </div>

            {/* Pipeline diagram */}
            <div style={S.panel}>
                <div style={S.panelTitle}>
                    <span style={{ ...S.dot, background: "#00d4aa" }} /> ML Pipeline Overview
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
                    {[
                        { step: "01", title: "Raw CSV", desc: "PJM hourly data\n145k rows · 2002–2018", color: "#4da6ff" },
                        { step: "02", title: "Clean & Resample", desc: "Fill gaps · hourly grid\nRemove duplicates", color: "#4da6ff" },
                        { step: "03", title: "Feature Engineering", desc: "15 features: lags, rolling\nstats, cyclic encoding", color: "#ffb347" },
                        { step: "04", title: "Train / Test Split", desc: "80% train · 20% test\nChronological — no shuffle", color: "#ffb347" },
                        { step: "05", title: "Random Forest", desc: "100 trees · max_depth 12\nmin_samples_leaf 4", color: "#00d4aa" },
                        { step: "06", title: "Evaluate", desc: "MAE 182 MW · RMSE 241\nR² 0.94 · Acc 96.2%", color: "#00d4aa" },
                        { step: "07", title: "Recursive Forecast", desc: "24-step ahead\nEach pred feeds next", color: "#ff4d6a" },
                    ].map((s, i, arr) => (
                        <div key={s.step} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ background: `${s.color}15`, border: `1px solid ${s.color}40`, borderRadius: 8, padding: "10px 14px", minWidth: 130 }}>
                                <div style={{ fontFamily: "monospace", fontSize: 9, color: s.color, marginBottom: 4, letterSpacing: "0.1em" }}>STEP {s.step}</div>
                                <div style={{ fontSize: 12, fontWeight: 500, color: "#e8f4f1", marginBottom: 4 }}>{s.title}</div>
                                <div style={{ fontSize: 10, color: "rgba(232,244,241,0.45)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{s.desc}</div>
                            </div>
                            {i < arr.length - 1 && (
                                <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.15)", flexShrink: 0, position: "relative" }}>
                                    <div style={{ position: "absolute", right: -4, top: -4, color: "rgba(255,255,255,0.3)", fontSize: 10 }}>▶</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}