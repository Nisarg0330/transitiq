/**
 * TransitIQ — Footer
 * ====================
 * Sticky footer with copyright and links.
 */

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      borderTop:  "1px solid #2D2D4A",
      background: "rgba(13,13,26,0.95)",
      padding:    "20px 24px",
      marginTop:  "auto",
    }}>
      <div style={{
        maxWidth:       "1200px",
        margin:         "0 auto",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        flexWrap:       "wrap",
        gap:            "12px",
      }}>

        {/* Left — Logo + copyright */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🚌</span>
          <span style={{ color: "#94A3B8", fontSize: "13px" }}>
            © {year} <strong style={{ color: "#6366F1" }}>TransitIQ</strong> — All rights reserved.
          </span>
        </div>

        {/* Right — Links */}
        <div style={{ display: "flex", gap: "20px" }}>
          {[
            { label: "Privacy Policy", href: "#" },
            { label: "Terms of Use",   href: "#" },
            { label: "Contact",        href: "mailto:support@transitiq.ca" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{
                color:          "#64748B",
                fontSize:       "13px",
                textDecoration: "none",
                transition:     "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#6366F1")}
              onMouseLeave={e => (e.currentTarget.style.color = "#64748B")}
            >
              {label}
            </a>
          ))}
        </div>

      </div>
    </footer>
  );
}
