import { useState, useEffect }                                from "react";
import { MapContainer, TileLayer, CircleMarker, Popup }      from "react-leaflet";
import { transitAPI, type PredictionResult, type RouteInfo } from "../lib/api";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

const TORONTO_CENTER: [number, number] = [43.6532, -79.3832];

const STOPS = [
  { pos: [43.6532, -79.3832] as [number, number], name: "Union Station",    risk: "high"     },
  { pos: [43.6629, -79.3957] as [number, number], name: "King & Spadina",   risk: "moderate" },
  { pos: [43.6703, -79.3883] as [number, number], name: "Dundas Square",    risk: "severe"   },
  { pos: [43.6797, -79.4076] as [number, number], name: "Bloor & Bathurst", risk: "low"      },
  { pos: [43.6456, -79.3806] as [number, number], name: "Front & Yonge",    risk: "moderate" },
];

const getRiskColor = (risk: string) => {
  switch (risk) {
    case "low":      return "#10B981";
    case "moderate": return "#F59E0B";
    case "high":     return "#F97316";
    case "severe":   return "#EF4444";
    default:         return "#6366F1";
  }
};

export function Dashboard() {
  const [routes, setRoutes]               = useState<RouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [prediction, setPrediction]       = useState<PredictionResult | null>(null);
  const [loading, setLoading]             = useState(false);
  const [stats, setStats]                 = useState<any[]>([]);
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768);

  useEffect(() => {
    transitAPI.getRoutes().then((data) => {
      setRoutes(data);
      if (data.length > 0) setSelectedRoute(data[0].route_id);
    }).catch(console.error);
    transitAPI.getStats().then(setStats).catch(console.error);
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const handlePredict = async () => {
  setLoading(true);
  try {
    // Fetch real current Toronto weather first
    const weather = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=43.7001&longitude=-79.4163&current=temperature_2m,precipitation&timezone=America%2FToronto"
    ).then(r => r.json());

    const temp   = weather.current.temperature_2m;
    const precip = weather.current.precipitation;

    const result = await transitAPI.predict({
      route_id:       selectedRoute,
      weather_temp:   temp,
      weather_precip: precip,
    });
    setPrediction(result);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  const ttcStats = stats.find(s => s.agency === "TTC");

  const statCards = [
    { label: "Total Events",  value: ttcStats ? parseInt(ttcStats.total_events).toLocaleString() : "—", icon: TrendingUp,   color: "#818CF8" },
    { label: "Delay Rate",    value: ttcStats ? `${ttcStats.delay_rate_pct}%` : "—",                    icon: AlertTriangle, color: "#F59E0B" },
    { label: "Avg Delay",     value: ttcStats ? `${Math.round(ttcStats.avg_delay_seconds / 60)}m` : "—", icon: Clock,        color: "#EF4444" },
    { label: "Model ROC-AUC", value: "0.91",                                                             icon: CheckCircle,  color: "#10B981" },
  ];

  return (
    <div style={{ background: "#080812", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: isMobile ? "22px" : "26px", fontWeight: "800", color: "#F8FAFC", letterSpacing: "-0.03em", marginBottom: "4px" }}>
            GTA Transit Dashboard
          </h1>
          <p style={{ color: "#334155", fontSize: "14px" }}>Real-time delay predictions powered by ML</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{
              padding:      "20px",
              borderRadius: "14px",
              background:   "rgba(255,255,255,0.02)",
              border:       "1px solid rgba(255,255,255,0.06)",
              transition:   "border-color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(99,102,241,0.25)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={17} color={color} />
                </div>
                <div>
                  <p style={{ color: "#334155", fontSize: "11px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</p>
                  <p style={{ color: "#F8FAFC", fontSize: isMobile ? "18px" : "22px", fontWeight: "800", letterSpacing: "-0.02em" }}>{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: "16px" }}>

          {/* Map / Stop list */}
          {isMobile ? (
            <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <MapPin size={15} color="#818CF8" />
                <span style={{ color: "#94A3B8", fontSize: "13px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" }}>Key Stops — Live Risk</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {STOPS.map(({ name, risk }) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "#94A3B8", fontSize: "14px" }}>{name}</span>
                    <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", background: `${getRiskColor(risk)}15`, color: getRiskColor(risk), border: `1px solid ${getRiskColor(risk)}30`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", height: "480px" }}>
              <MapContainer center={TORONTO_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                {STOPS.map(({ pos, name, risk }) => (
                  <CircleMarker key={name} center={pos} radius={10} pathOptions={{ color: getRiskColor(risk), fillColor: getRiskColor(risk), fillOpacity: 0.8, weight: 2 }}>
                    <Popup>
                      <div style={{ color: "#0D0D1A", fontWeight: "700", fontSize: "13px" }}>
                        {name}<br />
                        <span style={{ color: getRiskColor(risk), fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>{risk} RISK</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* Prediction Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Route Selector */}
            <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ color: "#334155", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>Predict Delay</p>
              <select
                value={selectedRoute}
                onChange={e => setSelectedRoute(e.target.value)}
                style={{
                  width:        "100%",
                  padding:      "10px 14px",
                  borderRadius: "10px",
                  background:   "rgba(255,255,255,0.04)",
                  border:       "1px solid rgba(255,255,255,0.1)",
                  color:        "#F8FAFC",
                  fontSize:     "14px",
                  marginBottom: "12px",
                  outline:      "none",
                  cursor:       "pointer",
                }}
              >
                {routes.slice(0, 50).map(r => (
                  <option key={r.route_id} value={r.route_id} style={{ background: "#0D0D1A" }}>
                    {r.agency} — Route {r.route_id}
                  </option>
                ))}
              </select>
              <button
                onClick={handlePredict}
                disabled={loading}
                style={{
                  width:        "100%",
                  padding:      "12px",
                  borderRadius: "10px",
                  border:       "none",
                  background:   loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  color:        "#fff",
                  fontSize:     "14px",
                  fontWeight:   "700",
                  cursor:       loading ? "not-allowed" : "pointer",
                  boxShadow:    loading ? "none" : "0 0 20px rgba(99,102,241,0.3)",
                  transition:   "all 0.2s",
                  letterSpacing: "-0.01em",
                }}
              >
                {loading ? "Analysing..." : "Get Prediction →"}
              </button>
            </div>

            {/* Prediction Result */}
            {prediction && (
              <div style={{
                padding:      "20px",
                borderRadius: "16px",
                background:   `linear-gradient(135deg, ${getRiskColor(prediction.risk_level)}08, rgba(255,255,255,0.02))`,
                border:       `1px solid ${getRiskColor(prediction.risk_level)}25`,
                animation:    "fadeIn 0.3s ease",
              }}>
                {/* Route + badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <p style={{ color: "#334155", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" }}>Route {prediction.route_id}</p>
                    <p style={{ color: "#F8FAFC", fontSize: "18px", fontWeight: "800", letterSpacing: "-0.02em" }}>{prediction.agency}</p>
                  </div>
                  <span style={{
                    padding:      "5px 12px",
                    borderRadius: "20px",
                    fontSize:     "11px",
                    fontWeight:   "800",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background:   `${getRiskColor(prediction.risk_level)}15`,
                    color:        getRiskColor(prediction.risk_level),
                    border:       `1px solid ${getRiskColor(prediction.risk_level)}30`,
                  }}>
                    {prediction.risk_level}
                  </span>
                </div>

                {/* Big numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                    <p style={{ color: "#334155", fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Delay Prob.</p>
                    <p style={{ fontSize: "36px", fontWeight: "900", color: getRiskColor(prediction.risk_level), letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {Math.round(prediction.delay_probability * 100)}%
                    </p>
                  </div>
                  <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                    <p style={{ color: "#334155", fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Est. Delay</p>
                    <p style={{ fontSize: "36px", fontWeight: "900", color: "#F8FAFC", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {prediction.estimated_delay_min}<span style={{ fontSize: "16px", color: "#334155" }}>m</span>
                    </p>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <p style={{ color: "#334155", fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Conditions</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {prediction.features_used.is_rush_hour && (
                      <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>⚡ Rush Hour</span>
                    )}
                    {prediction.features_used.is_snowing && (
                      <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "rgba(129,140,248,0.1)", color: "#818CF8", border: "1px solid rgba(129,140,248,0.2)" }}>❄️ Snowing</span>
                    )}
                    {prediction.features_used.is_raining && (
                      <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.2)" }}>🌧️ Raining</span>
                    )}
                    <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
                      🌡️ {prediction.features_used.weather_temp}°C
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}