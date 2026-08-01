"use client";

import type { ReactNode } from "react";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { I18nProvider } from "@/lib/i18n";
import { StandaloneAuthGate } from "./standalone-auth";
import { AuthLoadingScreen } from "./auth-loading-screen";

function AppContent({ children }: { children: ReactNode }) {
  const { isAuthenticated } = usePiAuth();
  if (!isAuthenticated) return <AuthLoadingScreen />;
  return <>{children}</>;
}

/**
 * Auth shell. Pi mode (default) uses the Pi SDK gate; standalone mode
 * (NEXT_PUBLIC_AUTH_MODE=standalone) runs as an independent web app with
 * email/password sign-in. Same app, one env switch (charter rule #4).
 */
export function AppWrapper({ children }: { children: ReactNode }) {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE ?? "pi";
  return (
    <I18nProvider>
      {mode === "standalone" ? (
        <StandaloneAuthGate>{children}</StandaloneAuthGate>
      ) : (
        <PiAuthProvider>
          <AppContent>{children}</AppContent>
        </PiAuthProvider>
      )}
    </I18nProvider>
  );
}
