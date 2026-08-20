'use client'

import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePiAuthOptional } from '@/contexts/pi-auth-context'

/**
 * Sign in as a pioneer. One button, no fields.
 *
 * ## Why there is nothing to type
 *
 * Inside the Pi Browser the pioneer is already a verified person: Pi has done
 * the identity work, including KYC, and the SDK will hand us a token that proves
 * it. Asking them for an email address and a password on top of that would
 * create a second, weaker account for the same human — and then their payments
 * would be attached to whichever of the two they happened to be signed into.
 *
 * So the Pi surface offers exactly this: press once, and the account exists.
 * The handshake also runs on its own when the app opens; this button is for the
 * cases where that did not land — the SDK was slow, the pioneer dismissed the
 * Pi prompt, the connection dropped — because a sign-in that can only happen
 * automatically is a sign-in nobody can retry.
 *
 * ## What it is not
 *
 * It is not a gate. The intelligence gateways are open to everyone without an
 * account (charter §1), so this renders beside the product, never in front of
 * it, and never on the public web where the handshake could only hang.
 */
export function PiSignIn() {
  const pi = usePiAuthOptional()

  // Not the Pi surface, or already signed in: nothing to offer.
  if (!pi?.active || pi.userData) return null

  const connecting = pi.status === 'connecting'

  return (
    <div className="space-y-2">
      <Button onClick={() => void pi.reinitialize()} disabled={connecting} className="w-full">
        {connecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {pi.authMessage}
          </>
        ) : (
          'Continue with Pi Network'
        )}
      </Button>
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" />
        {/*
          Said plainly because it is the reason there is no form: the pioneer is
          not being asked to create anything, and nothing they type could make
          the account more trustworthy than the one Pi already verified.
        */}
        Your Pi Network username becomes your account. Nothing to fill in, no second password, and
        your Pi payments stay attached to the identity Pi has already verified.
      </p>
      {/*
        A failed handshake is reported, not hidden. "Nothing happened" is the
        worst possible answer to a button press, and outside a real Pi Browser
        this is exactly what happens.
      */}
      {pi.status === 'unavailable' || pi.status === 'error' ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{pi.authMessage}</p>
      ) : null}
    </div>
  )
}
