"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { PI_NETWORK_CONFIG } from "@/lib/system-config";
import { api, setApiAuthToken } from "@/lib/api";
import {
  PI_TIMEOUTS,
  classifyPiFailure,
  piStatusMessage,
  withTimeout,
  type PiAuthStatus,
} from "@/lib/auth/pi-client";

// Our own login endpoint (independent of the App Studio default backend).
const LOGIN_URL = "/api/auth/pi";

export type LoginDTO = {
  id: string;
  username: string;
};

interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
}

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string; sandbox?: boolean }) => Promise<void>;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound?: (payment: {
          identifier: string
          metadata?: unknown
          transaction?: { txid?: string }
        }) => void,
      ) => Promise<PiAuthResult>;
    };
  }
}

interface PiAuthContextType {
  /**
   * Whether Pi is in play here at all.
   *
   * The provider is now mounted on every surface, so its mere presence no
   * longer tells shared chrome whether this is a Pi Browser session. Anything
   * that used to infer that from `usePiAuthOptional() !== null` must ask this
   * instead, or it will show Pi affordances to web visitors who have no Pi.
   */
  active: boolean;
  isAuthenticated: boolean;
  /** How the sign-in attempt ended; drives what the shell renders. */
  status: PiAuthStatus;
  /** True once the shell has waited long enough and should reveal the app. */
  graceElapsed: boolean;
  authMessage: string;
  piAccessToken: string | null;
  userData: LoginDTO | null;
  reinitialize: () => Promise<void>;
  /** Stop waiting and use the app without an account. */
  continueAsGuest: () => void;
}

const PiAuthContext = createContext<PiAuthContextType | undefined>(undefined);

const loadPiSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!PI_NETWORK_CONFIG.SDK_URL) {
      reject(new Error("SDK URL is not set"));
      return;
    }
    // Reuse the tag if a previous attempt already added it.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PI_NETWORK_CONFIG.SDK_URL}"]`
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = PI_NETWORK_CONFIG.SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Pi SDK script"));
    document.head.appendChild(script);
  });
};

/**
 * Pi sign-in for the whole app.
 *
 * ## Why it has an `active` switch
 *
 * The provider used to be mounted only by the Pi shell, so being mounted *was*
 * the switch. That stopped working when the surface became a runtime decision:
 * the app now hydrates as the web surface and may become the Pi surface an
 * instant later, and swapping the provider in at that moment would change the
 * element type above every screen — React would tear the entire app down and
 * rebuild it, on the slowest devices we ship to.
 *
 * So the provider is always in the tree and `active` says whether to actually
 * talk to Pi. Inactive, it loads no SDK, opens no handshake, and reports
 * `unavailable` with the grace window already closed — which is the truth
 * outside Pi Browser, and which no shell will ever block on.
 *
 * It also means `usePiAuth` has a provider everywhere, so shared chrome no
 * longer has to guess whether Pi is in play.
 */
export function PiAuthProvider({
  children,
  active = true,
}: {
  children: ReactNode
  /** Whether to attempt the Pi handshake at all. False outside Pi Browser. */
  active?: boolean
}) {
  const [status, setStatus] = useState<PiAuthStatus>(
    active ? "connecting" : "unavailable",
  );
  // Nothing to wait for when Pi is not in play, so nothing should be held back.
  const [graceElapsed, setGraceElapsed] = useState(!active);
  const [authMessage, setAuthMessage] = useState(
    piStatusMessage(active ? "connecting" : "unavailable"),
  );
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<LoginDTO | null>(null);

  /**
   * A payment the pioneer approved but that never completed — an app closed
   * mid-checkout, a lost connection. Pi hands it back on the next sign-in, and
   * it must be finished, or they have paid for something they never received.
   */
  const onIncompletePaymentFound = (payment: {
    identifier: string
    metadata?: unknown
    transaction?: { txid?: string }
  }): void => {
    const txid = payment?.transaction?.txid
    if (!payment?.identifier || !txid) return
    void fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The metadata carries which plan was bought; without it the payment
      // completes but grants nothing.
      body: JSON.stringify({
        action: "complete",
        paymentId: payment.identifier,
        txid,
        metadata: payment.metadata,
      }),
    }).catch(() => {
      /* Pi will offer it again next sign-in */
    })
  }

  const authenticateAndLogin = async (): Promise<void> => {
    setAuthMessage("Waiting for Pi Browser…");
    // The step that never settles outside Pi Browser — hence the timeout.
    /**
     * Scopes: `username` identifies the pioneer, `payments` is what makes
     * `Pi.createPayment` legal to call. Without the second one the subscribe
     * button exists and can never work — asking for it at sign-in is the only
     * point at which it can be granted.
     */
    const piAuthResult = await withTimeout(
      window.Pi.authenticate(["username", "payments"], onIncompletePaymentFound),
      PI_TIMEOUTS.authenticate,
      "Pi authentication"
    );

    setAuthMessage("Signing in…");
    const loginRes = await api.post<LoginDTO>(LOGIN_URL, {
      pi_auth_token: piAuthResult.accessToken,
    });

    if (piAuthResult?.accessToken) {
      setPiAccessToken(piAuthResult.accessToken);
      setApiAuthToken(piAuthResult.accessToken);
    }

    setUserData(loginRes.data);
  };

  const initializePiAndAuthenticate = async () => {
    setStatus("connecting");
    try {
      setAuthMessage("Loading the Pi SDK…");
      if (typeof window.Pi === "undefined") {
        await withTimeout(loadPiSDK(), PI_TIMEOUTS.sdk, "Pi SDK load");
      }
      if (typeof window.Pi === "undefined") {
        throw new Error("Pi SDK loaded but window.Pi is missing");
      }

      setAuthMessage(piStatusMessage("connecting"));
      await withTimeout(
        window.Pi.init({ version: "2.0", sandbox: PI_NETWORK_CONFIG.SANDBOX }),
        PI_TIMEOUTS.init,
        "Pi init"
      );

      await authenticateAndLogin();

      setStatus("authenticated");
      setAuthMessage(piStatusMessage("authenticated"));
    } catch (err) {
      // A timeout means "not inside Pi Browser" — expected, not a failure.
      const outcome = classifyPiFailure(err);
      if (outcome === "error") {
        console.error("Pi Network sign-in failed:", err);
      }
      setStatus(outcome);
      setAuthMessage(
        piStatusMessage(outcome, err instanceof Error ? err.message : undefined)
      );
    }
  };

  /**
   * Runs when Pi becomes relevant, not merely when the provider mounts.
   *
   * `active` starts false on every first render — the server cannot know it is
   * a Pi Browser — and turns true a moment later if it is one. Keying the
   * handshake on that transition is what lets one build serve both surfaces
   * without ever opening a Pi connection on the public web, where it could only
   * time out.
   */
  useEffect(() => {
    if (!active) return;
    initializePiAndAuthenticate();
    // Reveal the app once the grace window closes, whatever Pi is doing. The
    // handshake above keeps running and signs the user in if it lands later.
    const timer = setTimeout(() => setGraceElapsed(true), PI_TIMEOUTS.grace);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const continueAsGuest = () => {
    setGraceElapsed(true);
    setStatus("unavailable");
    setAuthMessage(piStatusMessage("unavailable"));
  };

  const value: PiAuthContextType = {
    active,
    isAuthenticated: status === "authenticated",
    status,
    graceElapsed,
    authMessage,
    piAccessToken,
    userData,
    reinitialize: initializePiAndAuthenticate,
    continueAsGuest,
  };

  return (
    <PiAuthContext.Provider value={value}>{children}</PiAuthContext.Provider>
  );
}

/**
 * Hook to access Pi Network authentication state and user data
 *
 * Must be used within a component wrapped by PiAuthProvider.
 * Provides read-only access to authentication state and user data.
 *
 * @returns {PiAuthContextType} Authentication state and methods
 * @throws {Error} If used outside of PiAuthProvider
 *
 * @example
 * const { piAccessToken, userData, isAuthenticated, reinitialize } = usePiAuth();
 */
export function usePiAuth() {
  const context = useContext(PiAuthContext);
  if (context === undefined) {
    throw new Error("usePiAuth must be used within a PiAuthProvider");
  }
  return context;
}

/**
 * Same state, but returns null instead of throwing when there is no provider.
 *
 * Standalone mode mounts no PiAuthProvider, so shared chrome like the header —
 * rendered in both modes — must be able to ask about Pi sign-in without
 * crashing the app in the mode where Pi is not in play.
 */
export function usePiAuthOptional(): PiAuthContextType | null {
  return useContext(PiAuthContext) ?? null;
}
