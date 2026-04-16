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
        body: JSON.stringify({}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

/** Fetch forecast + capacity together for the dashboard. */
export async function fetchDashboardData(): Promise<{
    forecast: AllRegionsForecast;
    capacity: AllRegionsCapacity;
}> {
    const [forecast, capacity] = await Promise.all([
        fetchAllRegions(),
        fetchAllRegionsCapacity(),
    ]);
    return { forecast, capacity };
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

// ── Dynamic Capacity Types ────────────────────────────────────────────────────

export interface CapacityHour {
    hour: number;
    label: string;
    total_capacity_mw: number;
    solar_cf: number;
    wind_cf: number;
    hydro_cf: number;
    thermal_cf: number;
    breakdown_mw: Record<string, number>;
    alerts: string[];
}

export interface RegionCapacity {
    total_available_mw: number;
    installed_total_mw: number;
    renewable_mw: number;
    thermal_mw: number;
    breakdown_mw: Record<string, number>;
    capacity_factors: Record<string, number>;
    alerts: string[];
}

export interface AllRegionsCapacity {
    timestamp_ist: string;
    hour: number;
    month: number;
    regions: Record<string, RegionCapacity>;
    all_india: {
        total_available_mw: number;
        installed_mw: number;
        renewable_mw: number;
        thermal_mw: number;
        renewable_pct: number;
    };
}

export async function fetchAllRegionsCapacity(): Promise<AllRegionsCapacity> {
    const res = await fetch(`${BASE}/api/capacity/all-regions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchCapacity24h(region: string, month?: number): Promise<{ region: string; month: number; hours: CapacityHour[] }> {
    const params = new URLSearchParams({ region });
    if (month) params.set("month", String(month));
    const res = await fetch(`${BASE}/api/capacity/24h?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}