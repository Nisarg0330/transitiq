import { useState }                       from "react";
import { Link, useLocation }              from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { LayoutDashboard, Route, User, Menu, X } from "lucide-react";

export function Navbar() {
  const location        = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/routes",    label: "Routes",    icon: Route           },
    { to: "/profile",   label: "Profile",   icon: User            },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav style={{
        position:       "sticky",
        top:            0,
        zIndex:         100,
        background:     "rgba(8,8,18,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom:   "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Logo */}
          <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>🚌</span>
            <span style={{
              fontSize:             "17px",
              fontWeight:           "800",
              letterSpacing:        "-0.02em",
              background:           "linear-gradient(135deg, #818CF8, #C4B5FD)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor:  "transparent",
            }}>
              TransitIQ
            </span>
          </Link>

          {/* Desktop links */}
          <SignedIn>
            <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {links.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "6px",
                  padding:        "7px 14px",
                  borderRadius:   "8px",
                  textDecoration: "none",
                  fontSize:       "13px",
                  fontWeight:     "600",
                  letterSpacing:  "-0.01em",
                  color:          isActive(to) ? "#A5B4FC" : "#64748B",
                  background:     isActive(to) ? "rgba(99,102,241,0.1)" : "transparent",
                  border:         isActive(to) ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
                  transition:     "all 0.2s",
                }}
                onMouseEnter={e => { if (!isActive(to)) { (e.currentTarget as HTMLAnchorElement).style.color = "#94A3B8"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)"; }}}
                onMouseLeave={e => { if (!isActive(to)) { (e.currentTarget as HTMLAnchorElement).style.color = "#64748B"; (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              ))}
              <div style={{ marginLeft: "12px", borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "12px" }}>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </SignedIn>

          {/* Mobile */}
          <SignedIn>
            <div className="mobile-nav" style={{ display: "none", alignItems: "center", gap: "12px" }}>
              <UserButton afterSignOutUrl="/" />
              <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px", display: "flex" }}>
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </SignedIn>

          <SignedOut>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link to="/" style={{ padding: "7px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94A3B8", fontSize: "13px", fontWeight: "600", textDecoration: "none", transition: "all 0.2s" }}>
                Sign In
              </Link>
            </div>
          </SignedOut>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <SignedIn>
            <div style={{ background: "rgba(8,8,18,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 0 16px" }}>
              {links.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={() => setOpen(false)} style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "12px",
                  padding:        "13px 24px",
                  textDecoration: "none",
                  fontSize:       "15px",
                  fontWeight:     "600",
                  color:          isActive(to) ? "#A5B4FC" : "#64748B",
                  background:     isActive(to) ? "rgba(99,102,241,0.08)" : "transparent",
                }}>
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>
          </SignedIn>
        )}
      </nav>

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .mobile-nav  { display: flex !important; }
        }
      `}</style>
    </>
  );
}