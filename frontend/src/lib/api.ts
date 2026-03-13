/**
 * TransitIQ — API Client
 * ========================
 * Axios instance for communicating with the Node.js API.
 * All API calls go through here.
 */

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// ── Types ─────────────────────────────────────────────────────

export interface PredictionResult {
  route_id:            string;
  agency:              string;
  scheduled_time:      string;
  delay_probability:   number;
  is_delayed:          boolean;
  risk_level:          "low" | "moderate" | "high" | "severe";
  estimated_delay_min: number;
  confidence:          string;
  features_used:       Record<string, any>;
}

export interface RouteInfo {
  route_id:     string;
  agency:       string;
  total_events: number;
  avg_delay:    number;
}

export interface ForecastPoint {
  time:                string;
  delay_probability:   number;
  risk_level:          string;
  estimated_delay_min: number;
}

export interface SavedRoute {
  id:         number;
  route_id:   string;
  agency:     string;
  nickname:   string;
  direction:  number;
  created_at: string;
}

// ── API Methods ───────────────────────────────────────────────

export const transitAPI = {

  // Health check
  health: async () => {
    const res = await api.get("/api/health");
    return res.data;
  },

  // Get all available routes
  getRoutes: async (): Promise<RouteInfo[]> => {
    const res = await api.get("/api/predict/routes");
    return res.data.routes;
  },

  // Predict delay for a single trip
  predict: async (params: {
    route_id:        string;
    agency?:         string;
    weather_temp?:   number;
    weather_precip?: number;
  }): Promise<PredictionResult> => {
    const res = await api.post("/api/predict", {
      ...params,
      scheduled_time: new Date().toISOString(),
    });
    return res.data;
  },

  // Get 12-hour forecast for a route
  getForecast: async (
    routeId:        string,
    agency?:        string,
    weatherTemp?:   number,
    weatherPrecip?: number,
  ): Promise<ForecastPoint[]> => {
    const res = await api.get(`/api/predict/route/${routeId}`, {
      params: {
        agency:         agency        || "TTC",
        weather_temp:   weatherTemp   || 5,
        weather_precip: weatherPrecip || 0,
      },
    });
    return res.data.forecast;
  },

  // Get delay stats
  getStats: async () => {
    const res = await api.get("/api/predict/stats");
    return res.data.stats;
  },

  // Get user's saved routes (requires auth token)
  getSavedRoutes: async (token: string): Promise<SavedRoute[]> => {
    const res = await api.get("/api/user/routes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.routes;
  },

  // Save a route
  saveRoute: async (token: string, params: {
    route_id:  string;
    agency:    string;
    nickname?: string;
  }): Promise<SavedRoute> => {
    const res = await api.post("/api/user/routes", params, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  // Remove a saved route
  removeRoute: async (token: string, id: number): Promise<void> => {
    await api.delete(`/api/user/routes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ── Push Notifications ──────────────────────────────────────

  // Save push subscription to DB
  subscribePush: async (subscription: object) => {
    const { data } = await api.post("/api/push/subscribe", subscription);
    return data;
  },

  // Remove push subscription from DB
  unsubscribePush: async () => {
    const { data } = await api.delete("/api/push/unsubscribe");
    return data;
  },

  // Send a test push notification
  testPush: async () => {
    const { data } = await api.post("/api/push/test", {});
    return data;
  },

};