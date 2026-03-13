import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Navbar } from "./components/Navbar";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { RoutesPage } from "./pages/RoutesPage";
import { Profile } from "./pages/Profile";
import { Footer } from "./components/Footer";


export default function App() {
  return (
    <div className="min-h-screen" style={{ background: "#0D0D1A" }}>

      {/* ── PUBLIC ROUTES (no login needed) ─────────────────── */}
      <SignedOut>
        <Routes>
          <Route path="*" element={<Landing />} />
        </Routes>
      </SignedOut>

      {/* ── PRIVATE ROUTES (login required) ─────────────────── */}
      <SignedIn>
        <Navbar />
        <main className="pb-8">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/routes"  element={<RoutesPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*"        element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
      </SignedIn>

    </div>
  );
}