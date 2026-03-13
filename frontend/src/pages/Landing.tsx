import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useNavigate }   from "react-router-dom";
import { useEffect, useState } from "react";
import { Brain, Bell, Map, Shield } from "lucide-react";

export function Landing() {
  const navigate  = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const features = [
    { icon: Brain,  color: "#6366F1", title: "ML Predictions",     desc: "LightGBM model trained on 270K+ real TTC events with 91% accuracy." },
    { icon: Bell,   color: "#8B5CF6", title: "Delay Alerts",        desc: "Get push notifications before delays happen on your saved routes."  },
    { icon: Map,    color: "#06B6D4", title: "Live Route Map",       desc: "Real-time risk levels for key stops across the GTA network."        },
    { icon: Shield, color: "#10B981", title: "Weather-Aware",        desc: "Predictions factor in snow, rain, temperature and rush hour."       },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A" }}>

      {/* Hero */}
      <div style={{
        maxWidth:  "900px",
        margin:    "0 auto",
        padding:   isMobile ? "48px 20px 40px" : "80px 24px 60px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: isMobile ? "48px" : "64px", marginBottom: "16px" }}>🚌</div>

        <h1 style={{
          fontSize:   isMobile ? "32px" : "56px",
          fontWeight: "800",
          color:      "#F8FAFC",
          lineHeight: "1.15",
          marginBottom: "20px",
        }}>
          Know Your Delays{" "}
          <span style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Before They Happen
          </span>
        </h1>

        <p style={{
          fontSize:     isMobile ? "16px" : "20px",
          color:        "#94A3B8",
          maxWidth:     "600px",
          margin:       "0 auto 32px",
          lineHeight:   "1.6",
        }}>
          AI-powered GTA transit delay predictions. Save your commute routes and get notified before you leave home.
        </p>

        {/* CTA Buttons */}
        <SignedOut>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <SignUpButton mode="modal">
              <button className="btn-primary" style={{ padding: "14px 28px", fontSize: "16px" }}>
                Get Started Free
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="btn-secondary" style={{ padding: "14px 28px", fontSize: "16px" }}>
                Sign In
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <button className="btn-primary" onClick={() => navigate("/dashboard")} style={{ padding: "14px 32px", fontSize: "16px" }}>
            Go to Dashboard →
          </button>
        </SignedIn>

        {/* Stats */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap:                 "16px",
          maxWidth:            "540px",
          margin:              "40px auto 0",
        }}>
          {[
            { value: "270K+",  label: "Transit Events" },
            { value: "91%",    label: "Model Accuracy" },
            { value: "3 min",  label: "Avg Alert Lead" },
          ].map(({ value, label }) => (
            <div key={label} className="glass-card" style={{ padding: "16px", textAlign: "center" }}>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#6366F1" }}>{value}</p>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobile ? "0 16px 60px" : "0 24px 80px" }}>
        <h2 style={{ textAlign: "center", fontSize: isMobile ? "24px" : "32px", fontWeight: "700", color: "#F8FAFC", marginBottom: "32px" }}>
          Why TransitIQ?
        </h2>
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap:                 "16px",
        }}>
          {features.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="glass-card" style={{ padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={22} color={color} />
              </div>
              <div>
                <h3 style={{ color: "#F8FAFC", fontWeight: "600", marginBottom: "6px" }}>{title}</h3>
                <p style={{ color: "#94A3B8", fontSize: "14px", lineHeight: "1.5" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <SignedOut>
          <div style={{ textAlign: "center", marginTop: "48px" }}>
            <SignUpButton mode="modal">
              <button className="btn-primary" style={{ padding: "14px 32px", fontSize: "16px" }}>
                Start Predicting for Free →
              </button>
            </SignUpButton>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "12px" }}>No credit card required</p>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}