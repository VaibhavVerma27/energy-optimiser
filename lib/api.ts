// lib/api.ts — India Smart Grid API Client (real data only, no mocks)

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ForecastHour {
    hour: number;
    timestamp: string;
    label: string;
    predicted_demand_mw: number;
    historical_baseline_mw: number;
    adjusted_demand_mw: number;
    capacity_mw: number;
}

export interface OverloadSummary {
    overload_detected: boolean;
    total_overload_hours: number;
    peak_predicted_mw: number;
    peak_hour: string;
    capacity_mw: number;
    excess_mw: number;
}

export interface DemandAction {
    name: string;
    type: "reduction" | "supply";
    reduction_mw: number;
    description: string;
    affected_segment: string;
    impact_level: "low" | "medium" | "high";
    cost_inr?: number;
    co2_kg?: number;
}

export interface DemandResponse {
    total_reduction_mw: number;
    peak_adjusted_mw: number;
    still_overloaded_hours: number;
    total_cost_inr?: number;
    total_co2_kg?: number;
    actions: DemandAction[];
    segment_breakdown: Record<string, { share_pct: number; peak_load_mw: number }>;
    adjusted_curve: { hour: number; label: string; original_mw: number; adjusted_mw: number; still_overloaded: boolean }[];
}

export interface RegionResult {
    region_col: string;
    region_label: string;
    region_id: string;
    forecast: ForecastHour[];
    overload_summary: OverloadSummary;
    demand_response: DemandResponse;
}

export interface AllRegionsForecast {
    regions: Record<string, RegionResult>;    // keyed by region_col e.g. "Northern_Region_mw"
    all_india: {
        forecast: ForecastHour[];
        peak_mw: number;
        capacity_mw: number;
        utilisation_pct: number;
    };
    errors: Record<string, string>;
    generated_at: string;
}

export interface ForecastStatus {
    models: Record<string, boolean>;
    all_models_ready: boolean;
    data_file: boolean;
    data_rows: number;
    data_date_range: string | null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch 24h forecast for all 5 regions + national in one call. */
export async function fetchAllRegions(): Promise<AllRegionsForecast> {
    const res = await fetch(`${BASE}/api/forecast/all-regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),   // backend uses latest CSV data automatically
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

/** Check model + data status. */
export async function fetchForecastStatus(): Promise<ForecastStatus> {
    const res = await fetch(`${BASE}/api/forecast/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/** Get recent demand values for a region (used by simulator). */
export async function fetchRecentDemand(regionCol?: string, hours = 168) {
    const params = new URLSearchParams({ hours: String(hours) });
    if (regionCol) params.set("region", regionCol);
    const res = await fetch(`${BASE}/api/demand/recent?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}