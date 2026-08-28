"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { schedulePiProbe } from "@/lib/auth/pi-probe";
import { I18nProvider } from "@/lib/i18n";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { AutoTranslate } from "./auto-translate";
import { PrefsProvider } from "./prefs-provider";
import { shouldBlockApp } from "@/lib/auth/pi-client";
import { subscribeToSurface, surfaceOnServer, surfaceSnapshot } from "@/lib/auth/environment";
import { refreshViewer } from "@/lib/auth/viewer";
import { pingVisit } from "@/lib/visit";
import { installDomResilience } from "@/lib/dom-resilience";

/**
 * Two pieces of chrome that render nothing on the first frame, fetched after it.
 *
 * The sign-in offer returns null until the session has been read, and it drags
 * the whole shared sign-in form in with it — 500 lines that a signed-in
 * visitor, and every visitor who never signs in, downloaded on every page. The
 * feedback button is a floating affordance that nobody is looking for in the
 * first 200ms of a page load.
 *
 * `ssr: false` on both, deliberately: neither has any server output to preserve
 * — the prompt renders null there by design and the button is chrome, not
 * content — so this removes them from the first load without changing a
 * character of the prerendered HTML.
 */
const StandaloneSignInPrompt = dynamic(
  () => import("./standalone-auth").then((m) => m.StandaloneSignInPrompt),
  { ssr: false },
);
const FeedbackButton = dynamic(() => import("./feedback-button").then((m) => m.FeedbackButton), {
  ssr: false,
});

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
  useEffect(() => {
    if (!userData) return;
    // Re-ping once Pi sign-in lands, so the visitor's Pi identity is attached
    // to their (now-known) country in the private registry. De-duped in
    // pingVisit.
    pingVisit("pi");
    /**
     * The Pi handshake creates a server session, and everything else in the app
     * reads the account from that session. Without this the header, the
     * composer and the account panel would go on showing a signed-out app to
     * someone who had just signed in — until they reloaded.
     */
    void refreshViewer();
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
  /**
   * Which shell to mount, decided where the visitor actually is.
   *
   * This used to read `NEXT_PUBLIC_AUTH_MODE`, a build-time switch — so one
   * build served Pi Browser and another served the public web, and a Pi user
   * who followed a link from a desktop reached a build offering only a sign-in
   * they could not complete there. The charter wants one product that is a Pi
   * app *and* a public website; that means one build and a runtime decision.
   *
   * The env var still wins when it is set, because an operator deploying a
   * deliberately single-purpose instance should be able to say so.
   *
   * Read through a store rather than called directly during render. Calling it
   * directly is what produced React error #418 in Pi Browser: the server has no
   * browser, answered `web`, and emitted the web shell — then the Pi client
   * answered `pi-browser` and rendered a different tree, so React threw the
   * hydration away and re-rendered the entire document on the slowest device we
   * ship to. `useSyncExternalStore` hydrates with the server's answer, so the
   * two agree, and adopts the real one immediately after as a normal update.
   * See lib/auth/environment.ts.
   */
  const surface = useSyncExternalStore(
    subscribeToSurface,
    surfaceSnapshot,
    surfaceOnServer,
  );
  const mode =
    process.env.NEXT_PUBLIC_AUTH_MODE ??
    (surface === "pi-browser" ? "pi" : "standalone");
  /**
   * Survive a translator editing the page underneath React.
   *
   * Installed before anything renders, and synchronously rather than in an
   * effect, because the very first reconciliation can already collide with the
   * browser's built-in translator — which most of our readers have on, since
   * most of them do not read English.
   *
   * Without this, one click produced "Failed to execute insertBefore on Node"
   * and the panel blanked. See lib/dom-resilience.ts.
   */
  if (typeof window !== "undefined") installDomResilience();
  /**
   * Ask Pi who this is, once, after the page is up.
   *
   * Without this nothing ever loads the Pi SDK unless the surface is already
   * believed to be Pi Browser — and the surface is believed to be Pi Browser
   * partly because the SDK loaded. A pioneer whose Pi Browser does not name
   * itself in its user agent sat inside that circle and was shown the email
   * form. See lib/auth/pi-probe.ts.
   */
  useEffect(() => {
    schedulePiProbe();
  }, []);
  /**
   * One beacon per open, for everyone (guest included). A signed-in re-ping
   * happens inside AppContent once identity is known.
   *
   * Deliberately not keyed on `mode`. The first render is always the server's
   * answer, so keying on it would record a Pi Browser visit as a web one and
   * then fire a second beacon. By the time an effect runs the user agent is
   * readable, so a single read here is both correct and final.
   */
  useEffect(() => {
    const live =
      process.env.NEXT_PUBLIC_AUTH_MODE ??
      (surfaceSnapshot() === "pi-browser" ? "pi" : "standalone");
    pingVisit(live === "standalone" ? "standalone-open" : "open");
  }, []);
  /**
   * One tree, whichever surface this turns out to be.
   *
   * The two shells used to be alternative branches, and that was a bug waiting
   * for the surface to become a runtime decision: the branch flips on the first
   * update after hydration, the element type above `children` changes with it,
   * and React unmounts and rebuilds *every screen in the app* — losing all of
   * their state and re-running every effect, on a Pi Browser phone.
   *
   * So the structure is fixed and only the leaves differ: the Pi provider is
   * always mounted and told whether Pi is in play, and the web sign-in offer is
   * a sibling card rather than a wrapper. Swapping surfaces now costs one card.
   */
  return (
    <I18nProvider>
      {/* Outside the auth layer on purpose: preferences must work for a visitor
          without an account, who is the ordinary case here (charter §1). The
          browser holds the working copy; an account only makes it durable. */}
      <PrefsProvider>
      {/* Translates the whole rendered interface, including text the engine
          produced at runtime, so a new screen is never English-only. */}
      <AutoTranslate>
      <PiAuthProvider active={mode === "pi"}>
        <AppContent>
          {children}
          {/* Inside the shell, so every screen carries it — an idea arrives
              while the user is looking at what prompted it. */}
          <FeedbackButton />
          {mode === "standalone" ? <StandaloneSignInPrompt /> : null}
        </AppContent>
      </PiAuthProvider>
      </AutoTranslate>
      </PrefsProvider>
    </I18nProvider>
  );
}
