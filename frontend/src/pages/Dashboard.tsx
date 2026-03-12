import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { transitAPI, type PredictionResult, type RouteInfo } from "../lib/api";
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Toronto center coordinates
const TORONTO_CENTER: [number, number] = [43.6532, -79.3832];

export function Dashboard() {
  const [routes, setRoutes]         = useState<RouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>("504");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [stats, setStats]           = useState<any[]>([]);

  useEffect(() => {
    transitAPI.getRoutes().then(setRoutes).catch(console.error);
    transitAPI.getStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedRoute) handlePredict();
  }, [selectedRoute]);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const result = await transitAPI.predict({ route_id: selectedRoute });
      setPrediction(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":      return "#10B981";
      case "moderate": return "#F59E0B";
      case "high":     return "#F97316";
      case "severe":   return "#EF4444";
      default:         return "#6366F1";
    }
  };

  const ttcStats = stats.find(s => s.agency === "TTC");

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }} className="animate-slide-up">
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#F8FAFC", marginBottom: "4px" }}>
          GTA Transit Dashboard
        </h1>
        <p style={{ color: "#94A3B8", fontSize: "14px" }}>
          Real-time delay predictions powered by ML
        </p>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      }}>
        {[
          {
            label: "Total Events",
            value: ttcStats ? parseInt(ttcStats.total_events).toLocaleString() : "—",
            icon: TrendingUp,
            color: "#6366F1",
          },
          {
            label: "Delay Rate",
            value: ttcStats ? `${ttcStats.delay_rate_pct}%` : "—",
            icon: AlertTriangle,
            color: "#F59E0B",
          },
          {
            label: "Avg Delay",
            value: ttcStats ? `${Math.round(ttcStats.avg_delay_seconds / 60)}m` : "—",
            icon: Clock,
            color: "#EF4444",
          },
          {
            label: "Model ROC-AUC",
            value: "0.91",
            icon: CheckCircle,
            color: "#10B981",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: `${color}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <p style={{ color: "#94A3B8", fontSize: "12px" }}>{label}</p>
                <p style={{ color: "#F8FAFC", fontSize: "22px", fontWeight: "700" }}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>

        {/* Map */}
        <div className="glass-card" style={{ overflow: "hidden", height: "500px" }}>
          <MapContainer
            center={TORONTO_CENTER}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {/* TTC Key Stops */}
            {[
              { pos: [43.6532, -79.3832] as [number, number], name: "Union Station",   risk: "high" },
              { pos: [43.6629, -79.3957] as [number, number], name: "King & Spadina",  risk: "moderate" },
              { pos: [43.6703, -79.3883] as [number, number], name: "Dundas Square",   risk: "severe" },
              { pos: [43.6797, -79.4076] as [number, number], name: "Bloor & Bathurst", risk: "low" },
              { pos: [43.6456, -79.3806] as [number, number], name: "Front & Yonge",   risk: "moderate" },
            ].map(({ pos, name, risk }) => (
              <CircleMarker
                key={name}
                center={pos}
                radius={10}
                pathOptions={{
                  color:     getRiskColor(risk),
                  fillColor: getRiskColor(risk),
                  fillOpacity: 0.7,
                }}
              >
                <Popup>
                  <div style={{ color: "#0D0D1A", fontWeight: "600" }}>
                    {name}
                    <br />
                    <span style={{ color: getRiskColor(risk), fontSize: "12px" }}>
                      {risk.toUpperCase()} RISK
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Prediction Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Route Selector */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <h3 style={{ color: "#F8FAFC", fontWeight: "600", marginBottom: "12px" }}>
              Predict Delay
            </h3>
            <select
              value={selectedRoute}
              onChange={e => setSelectedRoute(e.target.value)}
              className="input-dark"
              style={{ marginBottom: "12px" }}
            >
              {routes.slice(0, 50).map(r => (
                <option key={r.route_id} value={r.route_id}>
                  {r.agency} Route {r.route_id}
                </option>
              ))}
            </select>
            <button
              onClick={handlePredict}
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              {loading ? "Predicting..." : "Get Prediction"}
            </button>
          </div>

          {/* Prediction Result */}
          {prediction && (
            <div
              className={`glass-card risk-bg-${prediction.risk_level}`}
              style={{ padding: "20px", border: "1px solid", transition: "all 0.3s ease" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ color: "#F8FAFC", fontWeight: "600" }}>
                  Route {prediction.route_id}
                </h3>
                <span style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "700",
                  background: `${getRiskColor(prediction.risk_level)}20`,
                  color: getRiskColor(prediction.risk_level),
                  textTransform: "uppercase",
                }}>
                  {prediction.risk_level}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <p style={{ color: "#94A3B8", fontSize: "11px" }}>DELAY PROBABILITY</p>
                  <p style={{
                    fontSize: "28px", fontWeight: "700",
                    color: getRiskColor(prediction.risk_level),
                  }}>
                    {Math.round(prediction.delay_probability * 100)}%
                  </p>
                </div>
                <div>
                  <p style={{ color: "#94A3B8", fontSize: "11px" }}>EST. DELAY</p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "#F8FAFC" }}>
                    {prediction.estimated_delay_min}m
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #2D2D4A" }}>
                <p style={{ color: "#94A3B8", fontSize: "11px" }}>CONDITIONS</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  {prediction.features_used.is_rush_hour && (
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "#F59E0B20", color: "#F59E0B" }}>
                      Rush Hour
                    </span>
                  )}
                  {prediction.features_used.is_snowing && (
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "#6366F120", color: "#6366F1" }}>
                      Snowing
                    </span>
                  )}
                  {prediction.features_used.is_raining && (
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "#3B82F620", color: "#3B82F6" }}>
                      Raining
                    </span>
                  )}
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "#10B98120", color: "#10B981" }}>
                    {prediction.features_used.weather_temp}°C
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
