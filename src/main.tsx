import { Toaster } from "@/components/ui/sonner";
import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import NotFound from "./pages/NotFound.tsx";
import "./types/global.d.ts";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const Boards = lazy(() => import("./pages/Boards.tsx"));
const Canvas = lazy(() => import("./pages/Canvas.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Register = lazy(() => import("./pages/Register.tsx"));
const Guest = lazy(() => import("./pages/Guest.tsx"));

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <HashRouter>
        <AuthProvider>
        <RouteSyncer />
        <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading SketchFlow...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/guest" element={<Guest />} />
            <Route path="/" element={<Landing />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/boards" element={<Boards />} />
              <Route path="/canvas" element={<Canvas />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </AuthProvider>
        <Toaster />
      </HashRouter>
    </Provider>
  </StrictMode>,
);