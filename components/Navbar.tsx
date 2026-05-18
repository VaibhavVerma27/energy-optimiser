"use client";

import { usePathname } from "next/navigation";

const NAV_LINKS = [
    { href: "/",           label: "Home"          },
    { href: "/live",       label: "⚡ Forecast"   },
    { href: "/compare",    label: "⚖ Compare"    },
    { href: "/capacity",   label: "🔋 Capacity"   },
    { href: "/simulation", label: "📊 Merit Order" },
    { href: "/history",    label: "🗂 History"    },
];

export function Navbar() {
    const path = usePathname();

    return (
        <nav style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#0a0f14",
            position: "sticky",
            top: 0,
            zIndex: 100,
        }}>
            <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#00d4aa" }}>
          GRID<span style={{ color: "#e8f4f1" }}>AI</span>
        </span>
                <span style={{ fontSize: 9, color: "rgba(232,244,241,0.3)", letterSpacing: "0.08em", fontFamily: "monospace" }}>
          India Smart Grid
        </span>
            </a>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {NAV_LINKS.map(({ href, label }) => {
                    const active = href === "/" ? path === "/" : path.startsWith(href);
                    return (
                        <a key={href} href={href} style={{
                            fontFamily: "monospace", fontSize: 10, letterSpacing: "0.08em",
                            textDecoration: "none", padding: "5px 12px", borderRadius: 5,
                            background: active ? "rgba(0,212,170,0.12)" : "transparent",
                            color: active ? "#00d4aa" : "rgba(232,244,241,0.45)",
                            border: active ? "1px solid rgba(0,212,170,0.25)" : "1px solid transparent",
                            whiteSpace: "nowrap" as const,
                        }}>{label}</a>
                    );
                })}
            </div>
        </nav>
    );
}