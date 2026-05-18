// app/layout.tsx
import type { Metadata } from "next";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
    title: "GridAI — Smart Demand Forecasting",
    description: "AI-based electricity demand forecasting for India's grid",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
                href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;400;500&display=swap"
                rel="stylesheet"
            />
        </head>
        <body style={{ margin: 0, padding: 0, background: "#0a0f14" }}>
        <Navbar />
        {children}
        </body>
        </html>
    );
}