/**
 * TransitIQ — Navbar (Responsive)
 * =================================
 * Desktop: horizontal nav links
 * Mobile:  hamburger menu
 */

import { useState }                          from "react";
import { Link, useLocation }                 from "react-router-dom";
import { SignedIn, SignedOut, UserButton }    from "@clerk/clerk-react";
import { LayoutDashboard, Route, User, Menu, X } from "lucide-react";

export function Navbar() {
  const location          = useLocation();
  const [open, setOpen]   = useState(false);

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/routes",    label: "Routes",    icon: Route           },
    { to: "/profile",   label: "Profile",   icon: User            },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav style={{
      position:        "sticky",
      top:             0,
      zIndex:          100,
      background:      "rgba(13,13,26,0.95)",
      backdropFilter:  "blur(12px)",
      borderBottom:    "1px solid #2D2D4A",
      padding:         "0 20px",
    }}>
      <div style={{
        maxWidth:       "1200px",
        margin:         "0 auto",
        height:         "60px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
      }}>

        {/* Logo */}
        <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "24px" }}>🚌</span>
          <span style={{ fontSize: "18px", fontWeight: "700", color: "#6366F1" }}>TransitIQ</span>
        </Link>

        {/* Desktop Nav */}
        <SignedIn>
          <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} style={{
                display:        "flex",
                alignItems:     "center",
                gap:            "6px",
                padding:        "8px 14px",
                borderRadius:   "8px",
                textDecoration: "none",
                fontSize:       "14px",
                fontWeight:     "500",
                color:          isActive(to) ? "#6366F1" : "#94A3B8",
                background:     isActive(to) ? "#6366F115" : "transparent",
                transition:     "all 0.2s",
              }}>
                <Icon size={16} />
                {label}
              </Link>
            ))}
            <div style={{ marginLeft: "8px" }}>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </SignedIn>

        {/* Mobile: hamburger + UserButton */}
        <SignedIn>
          <div className="mobile-nav" style={{ display: "none", alignItems: "center", gap: "12px" }}>
            <UserButton afterSignOutUrl="/" />
            <button
              onClick={() => setOpen(!open)}
              style={{ background: "none", border: "none", color: "#F8FAFC", cursor: "pointer", padding: "4px" }}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </SignedIn>

        <SignedOut>
          <Link to="/" style={{ color: "#6366F1", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>
            Sign In
          </Link>
        </SignedOut>
      </div>

      {/* Mobile Dropdown Menu */}
      {open && (
        <SignedIn>
          <div style={{
            background:   "rgba(13,13,26,0.98)",
            borderTop:    "1px solid #2D2D4A",
            padding:      "12px 0",
          }}>
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "12px",
                  padding:        "14px 24px",
                  textDecoration: "none",
                  fontSize:       "16px",
                  fontWeight:     "500",
                  color:          isActive(to) ? "#6366F1" : "#F8FAFC",
                  background:     isActive(to) ? "#6366F110" : "transparent",
                }}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
          </div>
        </SignedIn>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .mobile-nav  { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}