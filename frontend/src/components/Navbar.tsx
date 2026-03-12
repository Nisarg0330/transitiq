import { Link, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { Map, Route, User } from "lucide-react";

export function Navbar() {
  const location = useLocation();

  const links = [
    { to: "/",        label: "Dashboard", icon: Map },
    { to: "/routes",  label: "Routes",    icon: Route },
    { to: "/profile", label: "Profile",   icon: User },
  ];

  return (
    <nav style={{
      background: "rgba(13, 13, 26, 0.95)",
      borderBottom: "1px solid #2D2D4A",
      backdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}>
              🚌
            </div>
            <span style={{
              fontSize: "20px",
              fontWeight: "700",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              TransitIQ
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                  background: isActive ? "rgba(99, 102, 241, 0.15)" : "transparent",
                  color: isActive ? "#6366F1" : "#94A3B8",
                  border: isActive ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* User Button (Clerk) */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: {
                width: "36px",
                height: "36px",
              }
            }
          }}
        />
      </div>
    </nav>
  );
}
