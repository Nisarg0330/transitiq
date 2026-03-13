import { useState, useEffect }                                from "react";
import { transitAPI, type RouteInfo, type PredictionResult } from "../lib/api";
import { Search, Zap }                                       from "lucide-react";

const getRiskColor = (risk: string) => {
  switch (risk) {
    case "low":      return "#10B981";
    case "moderate": return "#F59E0B";
    case "high":     return "#F97316";
    case "severe":   return "#EF4444";
    default:         return "#6366F1";
  }
};

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

  return (
    <div style={{ background: "#080812", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: isMobile ? "22px" : "26px", fontWeight: "800", color: "#F8FAFC", letterSpacing: "-0.03em", marginBottom: "4px" }}>
            Browse Routes
          </h1>
          <p style={{ color: "#334155", fontSize: "14px" }}>Click any route for an instant ML-powered delay prediction</p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <Search size={15} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#334155" }} />
          <input
            placeholder="Search by route number or agency..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width:        "100%",
              padding:      "11px 14px 11px 40px",
              borderRadius: "10px",
              background:   "rgba(255,255,255,0.03)",
              border:       "1px solid rgba(255,255,255,0.08)",
              color:        "#F8FAFC",
              fontSize:     "14px",
              outline:      "none",
              boxSizing:    "border-box",
              transition:   "border-color 0.2s",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.4)")}
            onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>

        {/* Prediction Result */}
        {prediction && (
          <div style={{
            padding:      "20px 24px",
            borderRadius: "14px",
            background:   `linear-gradient(135deg, ${getRiskColor(prediction.risk_level)}08, rgba(255,255,255,0.02))`,
            border:       `1px solid ${getRiskColor(prediction.risk_level)}25`,
            marginBottom: "20px",
            display:      "flex",
            justifyContent: "space-between",
            alignItems:   "center",
            flexWrap:     "wrap",
            gap:          "16px",
            animation:    "fadeIn 0.3s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: `${getRiskColor(prediction.risk_level)}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={22} color={getRiskColor(prediction.risk_level)} />
              </div>
              <div>
                <p style={{ color: "#334155", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" }}>Route {prediction.route_id} · {prediction.agency}</p>
                <p style={{ color: "#F8FAFC", fontSize: "16px", fontWeight: "800", letterSpacing: "-0.02em" }}>
                  {Math.round(prediction.delay_probability * 100)}% delay probability · Est. {prediction.estimated_delay_min}min
                </p>
              </div>
            </div>
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "800", letterSpacing: "0.06em", textTransform: "uppercase", background: `${getRiskColor(prediction.risk_level)}15`, color: getRiskColor(prediction.risk_level), border: `1px solid ${getRiskColor(prediction.risk_level)}30` }}>
              {prediction.risk_level} risk
            </span>
          </div>
        )}

        {/* Routes Grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
          {filtered.slice(0, 60).map(route => {
            const isSelected = prediction?.route_id === route.route_id;
            const isLoading  = loading === route.route_id;
            return (
              <button
                key={route.route_id}
                onClick={() => handlePredict(route.route_id)}
                disabled={!!loading}
                style={{
                  padding:      "16px 12px",
                  borderRadius: "12px",
                  background:   isSelected ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                  border:       isSelected ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(255,255,255,0.06)",
                  cursor:       loading ? "not-allowed" : "pointer",
                  textAlign:    "center",
                  transition:   "all 0.2s",
                  opacity:      isLoading ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}}
                onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}}
              >
                <div style={{ fontSize: "20px", fontWeight: "900", color: isSelected ? "#818CF8" : "#94A3B8", letterSpacing: "-0.02em", marginBottom: "4px" }}>
                  {isLoading ? "..." : route.route_id}
                </div>
                <div style={{ fontSize: "10px", color: "#334155", fontWeight: "600", letterSpacing: "0.04em" }}>{route.agency}</div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
            <p style={{ color: "#334155", fontSize: "15px" }}>No routes found for "{search}"</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}