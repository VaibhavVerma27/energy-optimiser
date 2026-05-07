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
    // Confidence interval (80% by default) — present when model has been retrained
    ci_lower_mw?: number;
    ci_upper_mw?: number;
    ci_level?: number;
    // Weather at forecast time (present when weather_fetcher.py has been run)
    weather_temp_c?: number;
    weather_humidity_pct?: number;
    // Holiday flags
    is_national_holiday?: number;
    is_major_festival?: number;
    is_diwali_window?: number;
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

export interface CustomForecastInput {
    // 168 hourly MW values per region (last 7 days).
    // If omitted the backend uses the last 168 rows of data/demand.csv.
    Northern_Region_mw?:     number[];
    Western_Region_mw?:      number[];
    Eastern_Region_mw?:      number[];
    Southern_Region_mw?:     number[];
    NorthEastern_Region_mw?: number[];
    demand_mw?:              number[];
    // ISO datetime for the first forecast hour (default: now rounded to hour)
    start_datetime?: string;
}

/** Fetch 24h forecast for all 5 regions + national in one call.
 *  Pass customInput to override the default "use last CSV data" behaviour. */
export async function fetchAllRegions(
    customInput?: CustomForecastInput
): Promise<AllRegionsForecast> {
    const body = customInput ?? {};
    const res = await fetch(`${BASE}/api/forecast/all-regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

/** Fetch forecast + capacity together for the dashboard.
 *  Pass customInput to run a forecast from user-supplied historical data. */
export async function fetchDashboardData(
    customInput?: CustomForecastInput
): Promise<{
    forecast: AllRegionsForecast;
    capacity: AllRegionsCapacity;
}> {
    const [forecast, capacity] = await Promise.all([
        fetchAllRegions(customInput),
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