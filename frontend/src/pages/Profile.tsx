import { useState, useEffect }              from "react";
import { useUser, useAuth }                from "@clerk/clerk-react";
import { transitAPI, type SavedRoute }     from "../lib/api";
import { Trash2, BookmarkPlus }            from "lucide-react";
import { PushToggle }                      from "../components/PushToggle";

export function Profile() {
  const { user }                        = useUser();
  const { getToken }                    = useAuth();
  const [savedRoutes, setSavedRoutes]   = useState<SavedRoute[]>([]);
  const [newRoute, setNewRoute]         = useState("");
  const [loading, setLoading]           = useState(false);
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 640);

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
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: isMobile ? "16px" : "24px" }}>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding: isMobile ? "20px" : "28px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{
            width:          "64px",
            height:         "64px",
            borderRadius:   "50%",
            background:     "linear-gradient(135deg, #6366F1, #8B5CF6)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       "24px",
            fontWeight:     "700",
            color:          "#fff",
            flexShrink:     0,
          }}>
            {user?.firstName?.[0] || "U"}
          </div>
          <div>
            <h2 style={{ color: "#F8FAFC", fontWeight: "700", fontSize: isMobile ? "18px" : "22px", marginBottom: "4px" }}>
              {user?.fullName || "User"}
            </h2>
            <p style={{ color: "#94A3B8", fontSize: "14px" }}>
              {user?.primaryEmailAddress?.emailAddress}
            </p>
            <span style={{ display: "inline-block", marginTop: "8px", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", background: "#6366F120", color: "#6366F1" }}>
              ⭐ {savedRoutes.length} saved routes
            </span>
          </div>
        </div>
      </div>

      {/* Saved Routes */}
      <div className="glass-card" style={{ padding: isMobile ? "16px" : "24px", marginBottom: "16px" }}>
        <h3 style={{ color: "#F8FAFC", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <BookmarkPlus size={18} color="#6366F1" /> My Saved Routes
        </h3>

        {/* Add Route */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            className="input-dark"
            placeholder="Enter route number (e.g. 504)"
            value={newRoute}
            onChange={e => setNewRoute(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            style={{ flex: 1 }}
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="btn-primary"
            style={{ padding: "0 16px", whiteSpace: "nowrap" }}
          >
            + Add
          </button>
        </div>

        {/* Route List */}
        {savedRoutes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "#64748B" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔖</div>
            <p>No saved routes yet</p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>Add your daily commute routes above</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {savedRoutes.map(route => (
              <div key={route.id} style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "12px 16px",
                borderRadius:   "10px",
                background:     "#1A1A2E",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width:          "40px",
                    height:         "40px",
                    borderRadius:   "8px",
                    background:     "#6366F120",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontSize:       "14px",
                    fontWeight:     "700",
                    color:          "#6366F1",
                    flexShrink:     0,
                  }}>
                    {route.route_id}
                  </div>
                  <div>
                    <p style={{ color: "#F8FAFC", fontWeight: "600", fontSize: "14px" }}>
                      Route {route.route_id}
                    </p>
                    <p style={{ color: "#64748B", fontSize: "12px" }}>{route.agency}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(route.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Push Notifications */}
      <div className="glass-card" style={{ padding: isMobile ? "16px" : "24px" }}>
        <h3 style={{ color: "#F8FAFC", fontWeight: "600", marginBottom: "8px" }}>Delay Notifications</h3>
        <p style={{ color: "#94A3B8", fontSize: "14px", marginBottom: "16px" }}>
          Get notified before delays happen on your saved routes.
        </p>
        <PushToggle />
      </div>
    </div>
  );
}