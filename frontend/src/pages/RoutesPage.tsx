import { useState, useEffect } from "react";
import { transitAPI, type RouteInfo, type PredictionResult } from "../lib/api";
import { Search, Zap } from "lucide-react";

export function RoutesPage() {
  const [routes, setRoutes]       = useState<RouteInfo[]>([]);
  const [filtered, setFiltered]   = useState<RouteInfo[]>([]);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<RouteInfo | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    transitAPI.getRoutes().then(r => {
      setRoutes(r);
      setFiltered(r);
    });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(routes.filter(r =>
      r.route_id.toLowerCase().includes(q) ||
      r.agency.toLowerCase().includes(q)
    ));
  }, [search, routes]);

  const handleSelect = async (route: RouteInfo) => {
    setSelected(route);
    setPrediction(null);
    setLoading(true);
    try {
      const result = await transitAPI.predict({
        route_id: route.route_id,
        agency:   route.agency,
      });
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

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#F8FAFC", marginBottom: "4px" }}>
          All Routes
        </h1>
        <p style={{ color: "#94A3B8", fontSize: "14px" }}>
          {routes.length} routes tracked across GTA
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>

        {/* Route List */}
        <div>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
            />
            <input
              className="input-dark"
              style={{ paddingLeft: "40px" }}
              placeholder="Search routes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Routes Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "12px",
            maxHeight: "600px",
            overflowY: "auto",
            paddingRight: "4px",
          }}>
            {filtered.map(route => (
              <button
                key={`${route.agency}-${route.route_id}`}
                onClick={() => handleSelect(route)}
                style={{
                  background: selected?.route_id === route.route_id
                    ? "rgba(99, 102, 241, 0.15)"
                    : "rgba(26, 26, 46, 0.8)",
                  border: selected?.route_id === route.route_id
                    ? "1px solid rgba(99, 102, 241, 0.5)"
                    : "1px solid #2D2D4A",
                  borderRadius: "12px",
                  padding: "16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{
                  fontSize: "20px", fontWeight: "700",
                  color: selected?.route_id === route.route_id ? "#6366F1" : "#F8FAFC",
                  marginBottom: "4px",
                }}>
                  {route.route_id}
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{route.agency}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                  {Math.round(Number(route.avg_delay) / 60)}m avg delay
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Prediction Panel */}
        <div>
          {!selected && (
            <div className="glass-card" style={{
              padding: "40px 20px", textAlign: "center",
            }}>
              <Zap size={40} color="#6366F1" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "#94A3B8" }}>Select a route to see its delay prediction</p>
            </div>
          )}

          {loading && (
            <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center" }}>
              <div className="animate-pulse-slow">
                <Zap size={40} color="#6366F1" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#94A3B8" }}>Predicting...</p>
              </div>
            </div>
          )}

          {prediction && !loading && (
            <div className="glass-card animate-slide-up" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ color: "#F8FAFC", fontSize: "22px", fontWeight: "700" }}>
                    Route {prediction.route_id}
                  </h2>
                  <p style={{ color: "#94A3B8", fontSize: "13px" }}>{prediction.agency}</p>
                </div>
                <span style={{
                  padding: "6px 14px", borderRadius: "20px",
                  fontSize: "13px", fontWeight: "700",
                  background: `${getRiskColor(prediction.risk_level)}20`,
                  color: getRiskColor(prediction.risk_level),
                  textTransform: "uppercase",
                }}>
                  {prediction.risk_level}
                </span>
              </div>

              {/* Big probability */}
              <div style={{
                textAlign: "center", padding: "24px",
                background: `${getRiskColor(prediction.risk_level)}10`,
                borderRadius: "12px", marginBottom: "16px",
                border: `1px solid ${getRiskColor(prediction.risk_level)}30`,
              }}>
                <p style={{ color: "#94A3B8", fontSize: "12px", marginBottom: "8px" }}>
                  DELAY PROBABILITY
                </p>
                <p style={{
                  fontSize: "56px", fontWeight: "800",
                  color: getRiskColor(prediction.risk_level),
                  lineHeight: 1,
                }}>
                  {Math.round(prediction.delay_probability * 100)}%
                </p>
                <p style={{ color: "#94A3B8", fontSize: "13px", marginTop: "8px" }}>
                  ~{prediction.estimated_delay_min} min estimated delay
                </p>
              </div>

              {/* Conditions */}
              <div>
                <p style={{ color: "#94A3B8", fontSize: "11px", marginBottom: "8px" }}>
                  CURRENT CONDITIONS
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "10px", background: "#6366F120", color: "#6366F1" }}>
                    {prediction.features_used.weather_temp}°C
                  </span>
                  {prediction.features_used.is_rush_hour && (
                    <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "10px", background: "#F59E0B20", color: "#F59E0B" }}>
                      Rush Hour
                    </span>
                  )}
                  {prediction.features_used.is_snowing && (
                    <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "10px", background: "#3B82F620", color: "#3B82F6" }}>
                      ❄️ Snowing
                    </span>
                  )}
                  {prediction.features_used.is_raining && (
                    <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "10px", background: "#06B6D420", color: "#06B6D4" }}>
                      🌧 Raining
                    </span>
                  )}
                  <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "10px", background: "#10B98120", color: "#10B981" }}>
                    Confidence: {prediction.confidence}
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
