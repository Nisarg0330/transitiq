export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      borderTop:  "1px solid rgba(255,255,255,0.06)",
      background: "rgba(8,8,18,0.95)",
      padding:    "24px",
      marginTop:  "auto",
    }}>
      <div style={{
        maxWidth:       "1200px",
        margin:         "0 auto",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        flexWrap:       "wrap",
        gap:            "16px",
      }}>

        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>🚌</span>
          <div>
            <span style={{
              fontSize:             "14px",
              fontWeight:           "800",
              letterSpacing:        "-0.02em",
              background:           "linear-gradient(135deg, #818CF8, #C4B5FD)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor:  "transparent",
            }}>
              TransitIQ
            </span>
            <span style={{ color: "#334155", fontSize: "13px", marginLeft: "8px" }}>
              © {year} All rights reserved.
            </span>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {[
            { label: "Privacy Policy", href: "#"                            },
            { label: "Terms of Use",   href: "#"                            },
            { label: "Contact",        href: "mailto:support@transitiq.ca"  },
          ].map(({ label, href }) => (
            <a key={label} href={href} style={{ color: "#334155", fontSize: "13px", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#818CF8")}
              onMouseLeave={e => (e.currentTarget.style.color = "#334155")}
            >
              {label}
            </a>
          ))}
        </div>

      </div>
    </footer>
  );
}