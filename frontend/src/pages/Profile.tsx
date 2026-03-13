import { useState, useEffect }           from "react";
import { useUser, useAuth }             from "@clerk/clerk-react";
import { transitAPI, type SavedRoute }  from "../lib/api";
import { Trash2, Plus, Bell }           from "lucide-react";
import { PushToggle }                   from "../components/PushToggle";

export function Profile() {
  const { user }                      = useUser();
  const { getToken }                  = useAuth();
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [newRoute, setNewRoute]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 640);

  useEffect(() => {
    loadRoutes();
    const handle = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const loadRoutes = async () => {
    try {
      const token  = await getToken();
      const routes = await transitAPI.getSavedRoutes(token!);
      setSavedRoutes(routes);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async () => {
    if (!newRoute.trim()) return;
    setLoading(true);
    try {
      const token = await getToken();
      await transitAPI.saveRoute(token!, { route_id: newRoute.trim(), agency: "TTC" });
      setNewRoute("");
      await loadRoutes();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      const token = await getToken();
      await transitAPI.removeRoute(token!, id);
      await loadRoutes();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ background: "#080812", minHeight: "100vh" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: isMobile ? "22px" : "26px", fontWeight: "800", color: "#F8FAFC", letterSpacing: "-0.03em", marginBottom: "4px" }}>
            My Profile
          </h1>
          <p style={{ color: "#334155", fontSize: "14px" }}>Manage your saved routes and notification preferences</p>
        </div>

        {/* Profile Card */}
        <div style={{ padding: "24px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width:          "56px",
              height:         "56px",
              borderRadius:   "14px",
              background:     "linear-gradient(135deg, #6366F1, #8B5CF6)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       "22px",
              fontWeight:     "900",
              color:          "#fff",
              flexShrink:     0,
              letterSpacing:  "-0.02em",
            }}>
              {user?.firstName?.[0] || "U"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#F8FAFC", fontWeight: "800", fontSize: "17px", letterSpacing: "-0.02em", marginBottom: "2px" }}>
                {user?.fullName || "User"}
              </p>
              <p style={{ color: "#334155", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <div style={{ padding: "6px 12px", borderRadius: "20px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", flexShrink: 0 }}>
              <span style={{ color: "#818CF8", fontSize: "12px", fontWeight: "700" }}>
                {savedRoutes.length} routes saved
              </span>
            </div>
          </div>
        </div>

        {/* Saved Routes */}
        <div style={{ padding: "24px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "16px" }}>
          <p style={{ color: "#334155", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
            My Saved Routes
          </p>

          {/* Add */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
              placeholder="Enter route number (e.g. 504)"
              value={newRoute}
              onChange={e => setNewRoute(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              style={{
                flex:         1,
                padding:      "10px 14px",
                borderRadius: "10px",
                background:   "rgba(255,255,255,0.04)",
                border:       "1px solid rgba(255,255,255,0.08)",
                color:        "#F8FAFC",
                fontSize:     "14px",
                outline:      "none",
                transition:   "border-color 0.2s",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.4)")}
              onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            <button
              onClick={handleAdd}
              disabled={loading}
              style={{
                padding:      "10px 16px",
                borderRadius: "10px",
                border:       "none",
                background:   "linear-gradient(135deg, #6366F1, #8B5CF6)",
                color:        "#fff",
                fontSize:     "14px",
                fontWeight:   "700",
                cursor:       loading ? "not-allowed" : "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          "6px",
                opacity:      loading ? 0.7 : 1,
                whiteSpace:   "nowrap",
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {/* Route List */}
          {savedRoutes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", borderRadius: "12px", background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔖</div>
              <p style={{ color: "#334155", fontSize: "14px" }}>No saved routes yet</p>
              <p style={{ color: "#1E293B", fontSize: "12px", marginTop: "4px" }}>Add your daily commute routes above</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {savedRoutes.map(route => (
                <div key={route.id} style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "12px 16px",
                  borderRadius:   "12px",
                  background:     "rgba(255,255,255,0.03)",
                  border:         "1px solid rgba(255,255,255,0.06)",
                  transition:     "border-color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(99,102,241,0.2)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "900", color: "#818CF8", flexShrink: 0 }}>
                      {route.route_id}
                    </div>
                    <div>
                      <p style={{ color: "#F8FAFC", fontWeight: "700", fontSize: "14px", letterSpacing: "-0.01em" }}>Route {route.route_id}</p>
                      <p style={{ color: "#334155", fontSize: "12px" }}>{route.agency}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(route.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#1E293B", padding: "6px", borderRadius: "8px", display: "flex", transition: "all 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Push Notifications */}
        <div style={{ padding: "24px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Bell size={16} color="#818CF8" />
            <p style={{ color: "#334155", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Delay Notifications
            </p>
          </div>
          <p style={{ color: "#334155", fontSize: "13px", marginBottom: "16px", lineHeight: "1.5" }}>
            Get push notifications before delays hit your saved routes — before you leave home.
          </p>
          <PushToggle />
        </div>

      </div>
    </div>
  );
}