"use client";

import { useEffect, type ReactNode } from "react";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { I18nProvider } from "@/lib/i18n";
import { StandaloneAuthGate } from "./standalone-auth";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { FeedbackButton } from "./feedback-button";
import { AutoTranslate } from "./auto-translate";
import { shouldBlockApp } from "@/lib/auth/pi-client";
import { pingVisit } from "@/lib/visit";

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
  const { status, graceElapsed, userData } = usePiAuth();
  // Re-ping once Pi sign-in lands, so the visitor's Pi identity is attached to
  // their (now-known) country in the private registry. De-duped in pingVisit.
  useEffect(() => {
    if (userData) pingVisit("pi");
  }, [userData]);
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
  // One beacon per open, for everyone (guest included). A signed-in re-ping
  // happens inside AppContent / the standalone gate once identity is known.
  useEffect(() => {
    pingVisit(mode === "standalone" ? "standalone-open" : "open");
  }, [mode]);
  return (
    <I18nProvider>
      {/* Translates the whole rendered interface, including text the engine
          produced at runtime, so a new screen is never English-only. */}
      <AutoTranslate>
      {mode === "standalone" ? (
        <StandaloneAuthGate>
          {children}
          <FeedbackButton />
        </StandaloneAuthGate>
      ) : (
        <PiAuthProvider>
          <AppContent>
            {children}
            {/* Inside the shell, so every screen carries it — an idea arrives
                while the user is looking at what prompted it. */}
            <FeedbackButton />
          </AppContent>
        </PiAuthProvider>
      )}
      </AutoTranslate>
    </I18nProvider>
  );
}
