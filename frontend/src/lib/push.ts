/**
 * TransitIQ — Push Notification Helper
 * =======================================
 * Handles service worker registration and push subscription.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

// Convert VAPID key from base64 to Uint8Array (required by browser API)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ── Register Service Worker ───────────────────────────────────
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers not supported");
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[Push] Service worker registered");
    return registration;
  } catch (err) {
    console.error("[Push] Service worker registration failed:", err);
    return null;
  }
}

// ── Subscribe to Push Notifications ──────────────────────────
export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    const registration = await registerServiceWorker();
    if (!registration) return null;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Push] Notification permission denied");
      return null;
    }

    // Check for existing subscription
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      console.log("[Push] Already subscribed");
      return existing;
    }

    // Create new subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });

    console.log("[Push] New subscription created");
    return subscription;

  } catch (err) {
    console.error("[Push] Subscription failed:", err);
    return null;
  }
}

// ── Unsubscribe ───────────────────────────────────────────────
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    await subscription.unsubscribe();
    console.log("[Push] Unsubscribed");
    return true;
  } catch (err) {
    console.error("[Push] Unsubscribe failed:", err);
    return false;
  }
}

// ── Check if subscribed ───────────────────────────────────────
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
