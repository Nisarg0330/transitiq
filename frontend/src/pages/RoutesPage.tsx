import { useState, useEffect }                              from "react";
import { transitAPI, type RouteInfo, type PredictionResult } from "../lib/api";
import { Search }                                            from "lucide-react";

export function RoutesPage() {
  const [routes, setRoutes]         = useState<RouteInfo[]>([]);
  const [search, setSearch]         = useState("");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading]       = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 640);

  useEffect(() => {
    transitAPI.getRoutes().then(setRoutes).catch(console.error);
    const handle = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const filtered = routes.filter(r =>
    r.route_id.toLowerCase().includes(search.toLowerCase()) ||
    r.agency.toLowerCase().includes(search.toLowerCase())
  );

  const handlePredict = async (routeId: string) => {
    setLoading(routeId);
    try {
      const result = await transitAPI.predict({
        route_id:       routeId,
        weather_temp:   parseFloat((Math.random() * 25 - 5).toFixed(1)),
        weather_precip: Math.random() > 0.7 ? parseFloat((Math.random() * 5).toFixed(1)) : 0,
      });
      setPrediction(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
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
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: isMobile ? "16px" : "24px" }}>

      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "700", color: "#F8FAFC", marginBottom: "4px" }}>
          Browse Routes
        </h1>
        <p style={{ color: "#94A3B8", fontSize: "14px" }}>Select any route to get an instant delay prediction</p>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
        <input
          className="input-dark"
          placeholder="Search routes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: "40px", width: "100%", boxSizing: "border-box" }}
        />
      </div>

      {/* Prediction Result */}
      {prediction && (
        <div className={`glass-card risk-bg-${prediction.risk_level}`} style={{ padding: "20px", marginBottom: "20px", border: "1px solid" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <h3 style={{ color: "#F8FAFC", fontWeight: "600" }}>Route {prediction.route_id} Prediction</h3>
            <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", background: `${getRiskColor(prediction.risk_level)}20`, color: getRiskColor(prediction.risk_level), textTransform: "uppercase" }}>
              {prediction.risk_level} risk
            </span>
          </div>
          <div style={{ display: "flex", gap: "24px", marginTop: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ color: "#94A3B8", fontSize: "11px" }}>DELAY PROBABILITY</p>
              <p style={{ fontSize: "28px", fontWeight: "700", color: getRiskColor(prediction.risk_level) }}>
                {Math.round(prediction.delay_probability * 100)}%
              </p>
            </div>
            <div>
              <p style={{ color: "#94A3B8", fontSize: "11px" }}>EST. DELAY</p>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#F8FAFC" }}>{prediction.estimated_delay_min}m</p>
            </div>
          </div>
        </div>
      )}

      {/* Routes Grid */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(160px, 1fr))",
        gap:                 "12px",
      }}>
        {filtered.slice(0, 60).map(route => (
          <button
            key={route.route_id}
            onClick={() => handlePredict(route.route_id)}
            disabled={loading === route.route_id}
            className="glass-card"
            style={{
              padding:    "16px",
              cursor:     "pointer",
              border:     prediction?.route_id === route.route_id ? "1px solid #6366F1" : "1px solid transparent",
              textAlign:  "left",
              transition: "all 0.2s",
              opacity:    loading === route.route_id ? 0.7 : 1,
            }}
          >
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#6366F1", marginBottom: "4px" }}>
              {loading === route.route_id ? "..." : route.route_id}
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8" }}>{route.agency}</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px", color: "#64748B" }}>
          No routes found for "{search}"
        </div>
      )}
    </div>
  );
}