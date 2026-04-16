import React from "react";

interface MetricCardProps {
    label: string;
    value: string | number;
    unit?: string;
    sub?: string;
    accent: "teal" | "red" | "amber" | "blue";
}

const accentColors = {
    teal:  { bar: "#00d4aa", text: "#00d4aa" },
    red:   { bar: "#ff4d6a", text: "#ff4d6a" },
    amber: { bar: "#ffb347", text: "#ffb347" },
    blue:  { bar: "#4da6ff", text: "#4da6ff" },
};

export function MetricCard({ label, value, unit, sub, accent }: MetricCardProps) {
    const colors = accentColors[accent];
    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "12px 14px",
            position: "relative", overflow: "hidden",
        }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: colors.bar }} />
            <div style={{ fontSize: 10, color: "rgba(232,244,241,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                {label}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 22, color: colors.text }}>
                {typeof value === "number" ? value.toLocaleString() : value}
                {unit && <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.7 }}>{unit}</span>}
            </div>
            {sub && <div style={{ fontSize: 10, color: "rgba(232,244,241,0.4)", marginTop: 3 }}>{sub}</div>}
        </div>
    );
}