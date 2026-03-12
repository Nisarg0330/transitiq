import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { transitAPI, type SavedRoute } from "../lib/api";
import { Bookmark, Trash2, Plus, Star } from "lucide-react";

export function Profile() {
  const { user }          = useUser();
  const { getToken }      = useAuth();
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading]         = useState(true);
  const [newRoute, setNewRoute]       = useState("");
  const [adding, setAdding]           = useState(false);

  useEffect(() => {
    loadSavedRoutes();
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const routes = await transitAPI.getSavedRoutes(token);
      setSavedRoutes(routes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newRoute.trim()) return;
    setAdding(true);
    try {
      const token = await getToken();
      if (!token) return;
      await transitAPI.saveRoute(token, {
        route_id: newRoute.trim(),
        agency:   "TTC",
        nickname: `Route ${newRoute.trim()}`,
      });
      setNewRoute("");
      await loadSavedRoutes();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert("Route already saved!");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      const token = await getToken();
      if (!token) return;
      await transitAPI.removeRoute(token, id);
      setSavedRoutes(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>

      {/* Profile Header */}
      <div className="glass-card animate-slide-up" style={{ padding: "32px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "28px", fontWeight: "700", color: "white",
          }}>
            {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#F8FAFC" }}>
              {user?.fullName || "Transit Commuter"}
            </h1>
            <p style={{ color: "#94A3B8", fontSize: "14px" }}>
              {user?.emailAddresses[0]?.emailAddress}
            </p>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <span style={{
                fontSize: "12px", padding: "2px 10px", borderRadius: "10px",
                background: "#6366F120", color: "#6366F1",
              }}>
                <Star size={10} style={{ display: "inline", marginRight: "4px" }} />
                {savedRoutes.length} saved routes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Routes */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ color: "#F8FAFC", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
            <Bookmark size={18} color="#6366F1" />
            My Saved Routes
          </h2>
        </div>

        {/* Add Route */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <input
            className="input-dark"
            placeholder="Enter route number (e.g. 504)"
            value={newRoute}
            onChange={e => setNewRoute(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="btn-primary"
            style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} />
            {adding ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Route List */}
        {loading ? (
          <p style={{ color: "#94A3B8", textAlign: "center", padding: "20px" }}>Loading...</p>
        ) : savedRoutes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <Bookmark size={40} color="#2D2D4A" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#94A3B8" }}>No saved routes yet</p>
            <p style={{ color: "#64748B", fontSize: "13px" }}>
              Add your daily commute routes above
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {savedRoutes.map(route => (
              <div
                key={route.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px", borderRadius: "12px",
                  background: "rgba(99, 102, 241, 0.05)",
                  border: "1px solid rgba(99, 102, 241, 0.15)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "10px",
                    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", fontWeight: "700", color: "white",
                  }}>
                    {route.route_id}
                  </div>
                  <div>
                    <p style={{ color: "#F8FAFC", fontWeight: "600" }}>{route.nickname}</p>
                    <p style={{ color: "#94A3B8", fontSize: "12px" }}>{route.agency}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(route.id)}
                  style={{
                    background: "transparent", border: "none",
                    cursor: "pointer", color: "#94A3B8", padding: "8px",
                    borderRadius: "8px", transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
