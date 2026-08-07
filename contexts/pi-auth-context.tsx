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
      authenticate: (scopes: string[]) => Promise<PiAuthResult>;
    };
  }
}

interface PiAuthContextType {
  isAuthenticated: boolean;
  /** How the sign-in attempt ended; drives what the shell renders. */
  status: PiAuthStatus;
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

export function PiAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PiAuthStatus>("connecting");
  const [authMessage, setAuthMessage] = useState(piStatusMessage("connecting"));
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<LoginDTO | null>(null);

  const authenticateAndLogin = async (): Promise<void> => {
    setAuthMessage("Waiting for Pi Browser…");
    // The step that never settles outside Pi Browser — hence the timeout.
    const piAuthResult = await withTimeout(
      window.Pi.authenticate(["username"]),
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

  useEffect(() => {
    initializePiAndAuthenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueAsGuest = () => {
    setStatus("unavailable");
    setAuthMessage(piStatusMessage("unavailable"));
  };

  const value: PiAuthContextType = {
    isAuthenticated: status === "authenticated",
    status,
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
