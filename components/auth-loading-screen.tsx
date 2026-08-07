"use client";

import { usePiAuth } from "@/contexts/pi-auth-context";

/**
 * Shown only while the Pi sign-in attempt is still in flight. It is bounded by
 * the timeouts in lib/auth/pi-client, so it always resolves on its own — and
 * the skip button lets an impatient visitor move on immediately rather than
 * watching a spinner they have no way to dismiss.
 */
export function AuthLoadingScreen() {
  const { authMessage, continueAsGuest } = usePiAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full px-6 text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Pi Network Authentication</h2>
          <p className="text-sm text-muted-foreground">{authMessage}</p>
        </div>

        <button
          onClick={continueAsGuest}
          className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Continue without signing in
        </button>
      </div>
    </div>
  );
}
