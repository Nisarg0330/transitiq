import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useNavigate }      from "react-router-dom";
import { useEffect, useState, useRef } from "react";

// ── Animated counter hook ─────────────────────────────────────
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref               = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = target / (duration / 16);
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(start));
      }, 16);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return { count, ref };
}

// ── Route pill ────────────────────────────────────────────────
function RoutePill({ route, delay, prob, color }: { route: string; delay: string; prob: number; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderRadius: "10px",
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
      marginBottom: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", color, flexShrink: 0 }}>
          {route}
        </div>
        <div>
          <div style={{ color: "#F8FAFC", fontSize: "13px", fontWeight: "600" }}>Route {route}</div>
          <div style={{ color: "#64748B", fontSize: "11px" }}>TTC · Est. {delay} delay</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color, fontSize: "18px", fontWeight: "700" }}>{prob}%</div>
        <div style={{ color: "#64748B", fontSize: "10px" }}>DELAY PROB.</div>
      </div>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────
export function Landing() {
  const navigate  = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handle = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handle);
    return () => window.removeEventListener("scroll", handle);
  }, []);

  const c1 = useCounter(270637);
  const c2 = useCounter(91);
  const c3 = useCounter(3);

  return (
    <div style={{ background: "#080812", minHeight: "100vh", overflowX: "hidden" }}>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-200px", left: "-200px", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", transform: `translateY(${scrollY * 0.1}px)` }} />
        <div style={{ position: "absolute", bottom: "-100px", right: "-100px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", padding: "80px 24px 60px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 420px", gap: "60px", alignItems: "center" }} className="hero-grid">

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "20px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", marginBottom: "28px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ color: "#A5B4FC", fontSize: "13px", fontWeight: "500" }}>Live · GTA Transit Intelligence</span>
            </div>

            <h1 style={{ fontSize: "clamp(38px, 5vw, 64px)", fontWeight: "800", lineHeight: "1.1", letterSpacing: "-0.03em", marginBottom: "24px", color: "#F8FAFC" }}>
              Stop Waiting.<br />
              <span style={{ background: "linear-gradient(135deg, #818CF8 0%, #A78BFA 50%, #C4B5FD 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Start Predicting.
              </span>
            </h1>

            <p style={{ fontSize: "18px", color: "#94A3B8", lineHeight: "1.7", maxWidth: "520px", marginBottom: "36px" }}>
              TransitIQ uses machine learning trained on <strong style={{ color: "#C4B5FD" }}>270,000+ real TTC events</strong> to predict delays before they happen — so you never miss another bus.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "48px" }}>
              <SignedOut>
                <SignUpButton mode="modal">
                  <button
                    style={{ padding: "14px 28px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", boxShadow: "0 0 30px rgba(99,102,241,0.4)", transition: "all 0.2s" }}
                    onMouseEnter={e => { const b = e.target as HTMLButtonElement; b.style.transform = "translateY(-2px)"; b.style.boxShadow = "0 0 40px rgba(99,102,241,0.6)"; }}
                    onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.transform = "translateY(0)"; b.style.boxShadow = "0 0 30px rgba(99,102,241,0.4)"; }}
                  >
                    Get Started Free →
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button
                    style={{ padding: "14px 28px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#94A3B8", fontSize: "15px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { const b = e.target as HTMLButtonElement; b.style.color = "#F8FAFC"; b.style.borderColor = "rgba(255,255,255,0.25)"; }}
                    onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.color = "#94A3B8"; b.style.borderColor = "rgba(255,255,255,0.12)"; }}
                  >
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <button onClick={() => navigate("/dashboard")} style={{ padding: "14px 28px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", boxShadow: "0 0 30px rgba(99,102,241,0.4)" }}>
                  Go to Dashboard →
                </button>
              </SignedIn>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
              {[
                { ref: c1.ref, value: c1.count.toLocaleString() + "+", label: "Transit Events" },
                { ref: c2.ref, value: c2.count + "%",                  label: "Model Accuracy" },
                { ref: c3.ref, value: c3.count + " min",               label: "Avg Alert Lead" },
              ].map(({ ref, value, label }) => (
                <div key={label} ref={ref}>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#F8FAFC", letterSpacing: "-0.02em" }}>{value}</div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Preview Card */}
          <div className="hero-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "24px", backdropFilter: "blur(20px)", boxShadow: "0 40px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ color: "#F8FAFC", fontWeight: "700", fontSize: "15px" }}>Live Predictions</div>
                <div style={{ color: "#64748B", fontSize: "12px" }}>Toronto · Right Now</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                <span style={{ color: "#10B981", fontSize: "11px", fontWeight: "600" }}>LIVE</span>
              </div>
            </div>
            <RoutePill route="504" delay="8m"  prob={87} color="#EF4444" />
            <RoutePill route="510" delay="4m"  prob={62} color="#F97316" />
            <RoutePill route="501" delay="12m" prob={94} color="#EF4444" />
            <RoutePill route="506" delay="2m"  prob={31} color="#10B981" />
            <RoutePill route="29"  delay="6m"  prob={71} color="#F59E0B" />
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#64748B", fontSize: "12px" }}>Powered by LightGBM · ROC-AUC 0.91</span>
              <span style={{ color: "#6366F1", fontSize: "12px", fontWeight: "600" }}>Sign up to unlock →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{ color: "#6366F1", fontSize: "13px", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Why TransitIQ</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: "800", color: "#F8FAFC", letterSpacing: "-0.02em", marginBottom: "16px" }}>Built for Toronto commuters</h2>
            <p style={{ color: "#64748B", fontSize: "16px", maxWidth: "500px", margin: "0 auto", lineHeight: "1.6" }}>Real ML, real data, real predictions — not just averages from a spreadsheet.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            {[
              { icon: "🧠", color: "#818CF8", title: "ML-Powered",    desc: "LightGBM model trained on 270K+ TTC events. 91% ROC-AUC. Smarter than any schedule.", stat: "0.91 AUC"         },
              { icon: "🔔", color: "#A78BFA", title: "Push Alerts",   desc: "Get notified on your phone or desktop before delays hit your route. Leave home informed.", stat: "< 1s delivery"   },
              { icon: "🌧️", color: "#60A5FA", title: "Weather-Aware", desc: "Snow, rain, temperature and rush hour all factor into every prediction automatically.",   stat: "5 weather signals" },
              { icon: "📍", color: "#34D399", title: "Your Routes",   desc: "Save your daily commute routes. We watch them every morning so you don't have to.",       stat: "Personalized"      },
            ].map(({ icon, color, title, desc, stat }) => (
              <div key={title}
                style={{ padding: "28px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.3s ease", cursor: "default" }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.background = "rgba(99,102,241,0.06)"; d.style.borderColor = "rgba(99,102,241,0.25)"; d.style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.background = "rgba(255,255,255,0.02)"; d.style.borderColor = "rgba(255,255,255,0.06)"; d.style.transform = "translateY(0)"; }}
              >
                <div style={{ fontSize: "32px", marginBottom: "16px" }}>{icon}</div>
                <div style={{ color: "#F8FAFC", fontWeight: "700", fontSize: "16px", marginBottom: "8px" }}>{title}</div>
                <p style={{ color: "#64748B", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px", margin: "0 0 16px 0" }}>{desc}</p>
                <div style={{ color, fontSize: "12px", fontWeight: "700", letterSpacing: "0.05em" }}>{stat}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ color: "#6366F1", fontSize: "13px", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>How It Works</div>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: "800", color: "#F8FAFC", marginBottom: "48px", letterSpacing: "-0.02em" }}>Three steps to a smarter commute</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "24px" }}>
            {[
              { step: "01", title: "Sign Up",      desc: "Create your free account in seconds."                       },
              { step: "02", title: "Save Routes",  desc: "Add your TTC routes to your personal dashboard."            },
              { step: "03", title: "Get Notified", desc: "Receive alerts before delays hit — right on your device."   },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ padding: "28px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "40px", fontWeight: "900", color: "rgba(99,102,241,0.25)", letterSpacing: "-0.04em", marginBottom: "12px" }}>{step}</div>
                <div style={{ color: "#F8FAFC", fontWeight: "700", fontSize: "16px", marginBottom: "8px" }}>{title}</div>
                <p style={{ color: "#64748B", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "60px 24px 100px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center", padding: "60px 40px", borderRadius: "24px", background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 0 80px rgba(99,102,241,0.1)" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🚌</div>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: "800", color: "#F8FAFC", marginBottom: "16px", letterSpacing: "-0.02em" }}>Ready to outsmart your commute?</h2>
          <p style={{ color: "#94A3B8", fontSize: "16px", marginBottom: "32px", lineHeight: "1.6" }}>Join other GTA commuters who never get caught off guard.</p>
          <SignedOut>
            <SignUpButton mode="modal">
              <button
                style={{ padding: "16px 36px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: "0 0 40px rgba(99,102,241,0.5)", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.target as HTMLButtonElement).style.transform = "scale(1.04)"}
                onMouseLeave={e => (e.target as HTMLButtonElement).style.transform = "scale(1)"}
              >
                Start for Free — No Credit Card
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <button onClick={() => navigate("/dashboard")} style={{ padding: "16px 36px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>
              Go to Dashboard →
            </button>
          </SignedIn>
        </div>
      </section>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-card { display: none !important; }
        }
      `}</style>
    </div>
  );
}