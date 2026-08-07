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
 * Only the brief connecting phase blocks. Every settled outcome — signed in,
 * no Pi Browser, or an outright failure — renders the app, because the free
 * intelligence gateways never required an account (charter §1) and the
 * signed-out state is already handled by the features that do need one.
 *
 * The alternative, gating the whole product behind a sign-in that cannot
 * complete outside Pi Browser, is what produced an endless spinner.
 */
function AppContent({ children }: { children: ReactNode }) {
  const { status } = usePiAuth();
  if (shouldBlockApp(status)) return <AuthLoadingScreen />;
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
