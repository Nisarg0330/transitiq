/**
 * TransitIQ — Push Notification Toggle
 * =======================================
 * Bell icon button that subscribes/unsubscribes from push notifications.
 * Used in Profile page and Navbar.
 */

import { useState, useEffect }                                     from "react";
import { Bell, BellOff }                                           from "lucide-react";
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed }  from "../lib/push";
import { api }                                                     from "../lib/api";
import { useAuth }                                                 from "@clerk/clerk-react";

export function PushToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [status, setStatus]         = useState<string | null>(null);

  const { getToken } = useAuth();

  useEffect(() => {
    isPushSubscribed().then(setSubscribed);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      if (subscribed) {
        // Unsubscribe
        await unsubscribeFromPush();
        await api.delete("/api/push/unsubscribe", { headers });
        setSubscribed(false);
        setStatus("Notifications disabled");
      } else {
        // Subscribe
        const sub = await subscribeToPush();
        if (!sub) {
          setStatus("Permission denied — enable notifications in browser settings");
          return;
        }
        await api.post("/api/push/subscribe", sub.toJSON(), { headers });
        setSubscribed(true);
        setStatus("Notifications enabled! ✓");

        // Send test notification after 1 second
        setTimeout(async () => {
          const t = await getToken();
          await api.post("/api/push/test", {}, {
            headers: { Authorization: `Bearer ${t}` },
          });
        }, 1000);
      }
    } catch (err) {
      setStatus("Something went wrong — try again");
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={subscribed ? "btn-secondary" : "btn-primary"}
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        "8px",
          padding:    "10px 20px",
          opacity:    loading ? 0.7 : 1,
        }}
      >
        {subscribed
          ? <><BellOff size={16} /> Disable Notifications</>
          : <><Bell    size={16} /> Enable Delay Alerts</>
        }
      </button>

      {status && (
        <p style={{
          fontSize: "12px",
          color:    status.includes("denied") ? "#EF4444" : "#10B981",
          marginTop: "4px",
        }}>
          {status}
        </p>
      )}
    </div>
  );
}