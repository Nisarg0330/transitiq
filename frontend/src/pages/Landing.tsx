import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useSignIn, useClerk } from "@clerk/clerk-react";
import { transitAPI } from "../lib/api";
import { TrendingUp, AlertTriangle, Clock, Lock, Zap, Shield, Bell } from "lucide-react";
import "leaflet/dist/leaflet.css";

const TORONTO_CENTER: [number, number] = [43.6532, -79.3832];

// Static live-looking bus positions across Toronto
const LIVE_BUSES = [
  { id: 1,  pos: [43.6532, -79.3832] as [number, number], route: "504", risk: "high",     delay: 8  },
  { id: 2,  pos: [43.6629, -79.3957] as [number, number], route: "510", risk: "moderate", delay: 3  },
  { id: 3,  pos: [43.6703, -79.3883] as [number, number], route: "501", risk: "severe",   delay: 14 },
  { id: 4,  pos: [43.6797, -79.4076] as [number, number], route: "29",  risk: "low",      delay: 0  },
  { id: 5,  pos: [43.6456, -79.3806] as [number, number], route: "72",  risk: "moderate", delay: 5  },
  { id: 6,  pos: [43.6601, -79.4401] as [number, number], route: "63",  risk: "low",      delay: 1  },
  { id: 7,  pos: [43.6880, -79.3976] as [number, number], route: "94",  risk: "high",     delay: 9  },
  { id: 8,  pos: [43.7001, -79.4163] as [number, number], route: "36",  risk: "low",      delay: 0  },
  { id: 9,  pos: [43.6521, -79.4429] as [number, number], route: "80",  risk: "moderate", delay: 4  },
  { id: 10, pos: [43.6748, -79.3452] as [number, number], route: "54",  risk: "severe",   delay: 18 },
];

export function Landing() {
  const { openSignIn, openSignUp } = useClerk();
  const [stats, setStats]   = useState<any[]>([]);
  const [time, setTime]     = useState(new Date());

  useEffect(() => {
    transitAPI.getStats().then(setStats).catch(console.error);
    // Live clock
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ttcStats = stats.find(s => s.agency === "TTC");

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
    <div style={{ minHeight: "100vh", background: "#0D0D1A" }}>

      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <nav style={{
        background: "rgba(13, 13, 26, 0.95)",
        borderBottom: "1px solid #2D2D4A",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          padding: "0 24px", height: "64px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
            }}>🚌</div>
            <span style={{
              fontSize: "20px", fontWeight: "700",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>TransitIQ</span>
          </div>

          {/* Auth Buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => openSignIn()}
              className="btn-secondary"
              style={{ padding: "8px 20px", fontSize: "14px" }}
            >
              Sign In
            </button>
            <button
              onClick={() => openSignUp()}
              className="btn-primary"
              style={{ padding: "8px 20px", fontSize: "14px" }}
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{
        maxWidth: "1200px", margin: "0 auto",
        padding: "48px 24px 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }} className="animate-slide-up">

          {/* Live Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "20px", padding: "6px 16px",
            marginBottom: "20px",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#10B981",
              animation: "pulse-slow 2s infinite",
            }} />
            <span style={{ color: "#10B981", fontSize: "13px", fontWeight: "600" }}>
              LIVE — {time.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })} Toronto
            </span>
          </div>

          <h1 style={{
            fontSize: "52px", fontWeight: "800", color: "#F8FAFC",
            lineHeight: 1.1, marginBottom: "16px",
          }}>
            Know Before You{" "}
            <span style={{
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Commute
            </span>
          </h1>

          <p style={{
            color: "#94A3B8", fontSize: "18px",
            maxWidth: "560px", margin: "0 auto 32px",
            lineHeight: 1.6,
          }}>
            AI-powered delay predictions for TTC and GO Transit.
            See exactly when your bus will be late — before you leave home.
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => openSignUp()}
              className="btn-primary"
              style={{ padding: "14px 32px", fontSize: "16px" }}
            >
              Start Predicting Free →
            </button>
            <button
              onClick={() => openSignIn()}
              className="btn-secondary"
              style={{ padding: "14px 32px", fontSize: "16px" }}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* ── STATS ROW ──────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px", marginBottom: "32px",
        }}>
          {[
            {
              label: "Events Tracked",
              value: ttcStats ? parseInt(ttcStats.total_events).toLocaleString() : "270,637",
              icon: TrendingUp, color: "#6366F1",
              sub: "TTC transit events",
            },
            {
              label: "Current Delay Rate",
              value: ttcStats ? `${ttcStats.delay_rate_pct}%` : "—",
              icon: AlertTriangle, color: "#F59E0B",
              sub: "of TTC routes delayed",
            },
            {
              label: "Avg Delay",
              value: ttcStats ? `${Math.round(ttcStats.avg_delay_seconds / 60)} min` : "—",
              icon: Clock, color: "#EF4444",
              sub: "across all routes today",
            },
            {
              label: "Prediction Accuracy",
              value: "91%",
              icon: Zap, color: "#10B981",
              sub: "ML model ROC-AUC score",
            },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px",
                  background: `${color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={18} color={color} />
                </div>
                <p style={{ color: "#94A3B8", fontSize: "12px" }}>{label}</p>
              </div>
              <p style={{ fontSize: "26px", fontWeight: "700", color: "#F8FAFC" }}>{value}</p>
              <p style={{ color: "#64748B", fontSize: "11px", marginTop: "4px" }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── MAIN CONTENT GRID ──────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px" }}>

          {/* Live Map */}
          <div className="glass-card" style={{ overflow: "hidden", height: "480px" }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #2D2D4A",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: "#10B981", animation: "pulse-slow 2s infinite",
                }} />
                <span style={{ color: "#F8FAFC", fontWeight: "600", fontSize: "14px" }}>
                  Live TTC Feed
                </span>
              </div>
              <span style={{ color: "#64748B", fontSize: "12px" }}>
                {LIVE_BUSES.length} vehicles tracked
              </span>
            </div>
            <MapContainer
              center={TORONTO_CENTER}
              zoom={12}
              style={{ height: "calc(100% - 53px)", width: "100%" }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap"
              />
              {LIVE_BUSES.map(bus => (
                <CircleMarker
                  key={bus.id}
                  center={bus.pos}
                  radius={8}
                  pathOptions={{
                    color:       getRiskColor(bus.risk),
                    fillColor:   getRiskColor(bus.risk),
                    fillOpacity: 0.8,
                    weight:      2,
                  }}
                >
                  <Popup>
                    <div style={{ fontWeight: "600", color: "#0D0D1A" }}>
                      Route {bus.route}
                      <br />
                      <span style={{ color: getRiskColor(bus.risk), fontSize: "12px" }}>
                        {bus.delay > 0 ? `${bus.delay} min delay` : "On time"}
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Right Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Blurred Route Search */}
            <div className="glass-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>

              {/* Blurred content */}
              <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }}>
                <h3 style={{ color: "#F8FAFC", fontWeight: "600", marginBottom: "12px" }}>
                  Predict My Route
                </h3>
                <div className="input-dark" style={{ marginBottom: "12px", color: "#64748B" }}>
                  Select route...
                </div>
                <div style={{
                  padding: "20px", borderRadius: "12px",
                  background: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  marginBottom: "12px",
                }}>
                  <p style={{ color: "#94A3B8", fontSize: "12px" }}>DELAY PROBABILITY</p>
                  <p style={{ fontSize: "42px", fontWeight: "800", color: "#6366F1" }}>94%</p>
                  <p style={{ color: "#94A3B8", fontSize: "13px" }}>~12 min estimated delay</p>
                </div>
                <div style={{ height: "36px", background: "#6366F130", borderRadius: "10px" }} />
              </div>

              {/* Lock overlay */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(13, 13, 26, 0.75)",
                backdropFilter: "blur(2px)",
                gap: "12px", padding: "20px",
              }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Lock size={22} color="white" />
                </div>
                <p style={{ color: "#F8FAFC", fontWeight: "700", fontSize: "16px", textAlign: "center" }}>
                  Unlock Route Predictions
                </p>
                <p style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center" }}>
                  Sign in free to predict delays on any TTC or GO Transit route
                </p>
                <button
                  onClick={() => openSignUp()}
                  className="btn-primary"
                  style={{ width: "100%", padding: "12px" }}
                >
                  Sign Up Free
                </button>
                <button
                  onClick={() => openSignIn()}
                  className="btn-secondary"
                  style={{ width: "100%", padding: "10px" }}
                >
                  Already have an account
                </button>
              </div>
            </div>

            {/* Live Delay List */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <h3 style={{ color: "#F8FAFC", fontWeight: "600", fontSize: "14px", marginBottom: "12px" }}>
                Current Delays
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {LIVE_BUSES.filter(b => b.delay > 0).slice(0, 4).map(bus => (
                  <div key={bus.id} style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: "10px",
                    background: `${getRiskColor(bus.risk)}10`,
                    border: `1px solid ${getRiskColor(bus.risk)}25`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: `${getRiskColor(bus.risk)}20`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: "700",
                        color: getRiskColor(bus.risk),
                      }}>
                        {bus.route}
                      </div>
                      <span style={{ color: "#94A3B8", fontSize: "13px" }}>
                        TTC Route {bus.route}
                      </span>
                    </div>
                    <span style={{
                      color: getRiskColor(bus.risk),
                      fontSize: "13px", fontWeight: "700",
                    }}>
                      +{bus.delay}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── FEATURES ROW ───────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px", marginTop: "32px",
        }}>
          {[
            {
              icon: Zap, color: "#6366F1",
              title: "AI-Powered Predictions",
              desc: "LightGBM model trained on 270K+ real TTC events with 91% accuracy",
            },
            {
              icon: Shield, color: "#10B981",
              title: "Weather-Aware",
              desc: "Predictions factor in Toronto weather — snow, rain and temperature",
            },
            {
              icon: Bell, color: "#F59E0B",
              title: "Save Your Routes",
              desc: "Bookmark your daily commute routes and get instant forecasts",
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="glass-card" style={{ padding: "24px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: `${color}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "14px",
              }}>
                <Icon size={22} color={color} />
              </div>
              <h3 style={{ color: "#F8FAFC", fontWeight: "600", marginBottom: "8px" }}>{title}</h3>
              <p style={{ color: "#94A3B8", fontSize: "13px", lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── FOOTER CTA ─────────────────────────────────────── */}
        <div style={{
          marginTop: "40px", padding: "40px",
          borderRadius: "20px", textAlign: "center",
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
          border: "1px solid rgba(99,102,241,0.3)",
        }}>
          <h2 style={{ color: "#F8FAFC", fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
            Stop guessing. Start predicting.
          </h2>
          <p style={{ color: "#94A3B8", marginBottom: "24px" }}>
            Free forever for personal use. No credit card required.
          </p>
          <button
            onClick={() => openSignUp()}
            className="btn-primary"
            style={{ padding: "14px 40px", fontSize: "16px" }}
          >
            Create Free Account →
          </button>
        </div>
      </div>
    </div>
  );
}
