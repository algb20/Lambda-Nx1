'use client'

import { useCallback, useState } from 'react'
import { Radar, ShieldCheck, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AuthForm } from '@/components/auth-form'
import { useViewer } from '@/hooks/use-viewer'
import { refreshViewer } from '@/lib/auth/viewer'

/**
 * The off-Pi sign-in offer. It signs people in; it does **not** gate anything.
 *
 * ## The regression this documents
 *
 * This used to be a *gate*: it wrapped the whole app and rendered a full-screen
 * sign-in card whenever nobody was signed in, with nothing behind it. That was
 * survivable while it only ran under an explicit `NEXT_PUBLIC_AUTH_MODE=
 * standalone` deployment — and the moment the shell started choosing this
 * surface automatically for every ordinary browser, it locked the entire
 * product behind an account for every web visitor.
 *
 * Which contradicts charter §1 outright: the intelligence gateways are open,
 * need no account, and are the reason someone arrives. It also mirrors a bug
 * the Pi shell already had and already fixed — gating everything behind a
 * sign-in that most visitors have no reason to complete.
 *
 * So it stopped wrapping the app and became what it always should have been: a
 * small card that sits *beside* the product. A signed-out visitor gets the whole
 * free platform and an unobtrusive prompt; signing in also lives in
 * Preferences, where the account already is.
 *
 * Being a sibling rather than a wrapper matters for a second reason. The surface
 * is decided after hydration, so this component appears or disappears on the
 * first update — and if it still wrapped `children`, that update would change
 * the element type above the entire app and React would unmount and rebuild
 * every screen, losing all of it. As a sibling, the swap costs one card.
 *
 * The form itself lives in `auth-form.tsx`, shared with the account panel in
 * Preferences, so there is exactly one sign-in implementation to keep correct.
 */
export function StandaloneSignInPrompt() {
  const { status, user } = useViewer()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)

  // Signing in changes the account for the whole app, not just this card.
  const onAuthenticated = useCallback(() => {
    void refreshViewer()
  }, [])

  /**
   * Nothing is shown while the session is still being read, and nothing is
   * shown to someone already signed in.
   *
   * A spinner here would put a placeholder over a platform that never needed
   * the answer — the gateways do not care whether anyone is signed in.
   */
  if (status !== 'ready' || user) return null

  return (
    <>
      {/*
        A prompt, not a gate. It sits above the product rather than in front of
        it, and it can be dismissed — a visitor reading the world map has no
        reason to make an account, and asking twice is how they leave.

        Centred above the tab bar on a phone; on a wide screen it sits at the
        foot of the navigation column, narrow enough to stay inside it.

        It used to be centred at every width, which on a desktop put it squarely
        on top of the board — a prompt nobody asked for, covering the rows they
        came to read. The left is chosen over the right because the ideas button
        already occupies that corner, and the width is pinned to the nav column
        rather than left to `max-w-sm`, which overhung the content by enough to
        clip the first words of every line beneath it.
      */}
      {dismissed ? null : (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto w-full max-w-sm px-3 lg:inset-x-auto lg:bottom-4 lg:left-4 lg:mx-0 lg:w-56 lg:max-w-none lg:px-0">
          <Card className="p-2.5 shadow-lg lg:p-3">
            {/*
              ## Why the pitch is folded away on a phone

              It was a three-paragraph card, `fixed` above the tab bar, at every
              width. Measured on a 320×640 screen it stood 180px tall — 28% of
              everything the visitor could see, permanently covering the product
              they came for, until they found the small × in its corner. On a
              tablet it landed in the middle of the page and covered the globe's
              legend.

              So on a narrow screen it is one line: what it is, and a way in.
              The full invitation is still there for anyone who taps, and the
              whole card is unchanged from `lg` up, where there is room at the
              foot of the navigation column for it to sit beside the product
              rather than on top of it.
            */}
            <div className="flex items-start gap-2">
              <Radar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Keep your work</p>
                <div className={open ? '' : 'hidden lg:block'}>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    Everything here works without an account. One keeps your investigations, monitors
                    and settings across devices.
                  </p>
                  {/*
                    The word "email" belongs here, in the invitation, and nowhere
                    near the input labels. A person deciding whether to bother
                    needs to know what it will cost them; a person already typing
                    does not need to be told twice.
                  */}
                  <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                    Takes an email address and about twenty seconds.
                  </p>
                </div>
              </div>
              {/*
                22px of button is a third of what a thumb needs. The visual size
                is right for an 11px card and the touch area is grown outwards
                on a touch screen only — see `.touch-target` in globals.css.
              */}
              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="touch-target shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {open ? (
              <div className="mt-3">
                <AuthForm onAuthenticated={onAuthenticated} />
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Our own signed sessions — passwords hashed, never stored in plain text.
                </p>
              </div>
            ) : (
              <button
                onClick={() => setOpen(true)}
                className="mt-2 min-h-11 w-full rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:mt-2 lg:min-h-0 lg:py-1.5"
              >
                Sign in or create an account
              </button>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
