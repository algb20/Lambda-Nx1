"use client";

import type { ReactNode } from "react";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { I18nProvider } from "@/lib/i18n";
import { StandaloneAuthGate } from "./standalone-auth";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { shouldBlockApp } from "@/lib/auth/pi-client";

/**
 * Pi mode shell.
 *
 * The handshake gets a short grace window to finish — long enough that a Pi
 * Browser user lands straight in a signed-in app, short enough that everyone
 * else reaches the product almost immediately. After that the app renders
 * regardless, while the handshake continues in the background.
 *
 * The free intelligence gateways never required an account (charter §1), and
 * the features that do need one already handle the signed-out case. Gating the
 * whole product behind a sign-in that only Pi Browser can complete is what
 * produced an endless spinner in an ordinary browser.
 */
function AppContent({ children }: { children: ReactNode }) {
  const { status, graceElapsed } = usePiAuth();
  if (shouldBlockApp(status, graceElapsed)) return <AuthLoadingScreen />;
  return <>{children}</>;
}

/**
 * Auth shell. Pi mode (default) uses the Pi SDK gate; standalone mode
 * (NEXT_PUBLIC_AUTH_MODE=standalone) runs as an independent web app with
 * email/password sign-in. Same app, one env switch (charter rule #4).
 *
 * Pi mode is now safe to ship everywhere: inside Pi Browser it signs the user
 * in, and in an ordinary browser it falls through to the open app rather than
 * trapping the visitor. One build serves both.
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
