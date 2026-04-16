// components/ActionPanel.tsx
import type { DemandAction } from "../lib/api";

interface ActionPanelProps {
    actions: DemandAction[];
}

const impactConfig = {
    low:    { color: "#00d4aa", bg: "rgba(0,212,170,0.1)",   border: "#00d4aa", badge: "rgba(0,212,170,0.15)" },
    medium: { color: "#ffb347", bg: "rgba(255,179,71,0.07)", border: "#ffb347", badge: "rgba(255,179,71,0.15)" },
    high:   { color: "#ff4d6a", bg: "rgba(255,77,106,0.07)", border: "#ff4d6a", badge: "rgba(255,77,106,0.15)" },
};

const impactLabel = { low: "Active", medium: "Triggered", high: "Standby" };

export function ActionPanel({ actions }: ActionPanelProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actions.map((action) => {
                const cfg = impactConfig[action.impact_level];
                return (
                    <div
                        key={action.name}
                        style={{
                            background: cfg.bg,
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderLeft: `3px solid ${cfg.border}`,
                            borderRadius: 6,
                            padding: "10px 12px",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#e8f4f1" }}>{action.name}</span>
                            <span style={{
                                background: cfg.badge, color: cfg.color,
                                fontSize: 9, padding: "2px 7px", borderRadius: 3,
                                fontFamily: "monospace", letterSpacing: "0.05em",
                            }}>
                {impactLabel[action.impact_level]}
              </span>
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(232,244,241,0.55)", lineHeight: 1.5 }}>
                            {action.description}
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: cfg.color, marginTop: 4 }}>
                            {action.type === "reduction"
                                ? `− ${action.reduction_mw.toLocaleString()} MW reduction`
                                : `+ ${action.reduction_mw.toLocaleString()} MW supply`}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}