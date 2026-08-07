'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePiAuthOptional } from '@/contexts/pi-auth-context'
import { useI18n } from '@/lib/i18n'

interface PlanDTO {
  id: 'free' | 'pro'
  name: string
  price: { pi: number; usd: number; interval: string }
  limits: { dailyInvestigations: number; monitors: number }
  features: string[]
}

type Phase = 'idle' | 'creating' | 'approving' | 'completing' | 'done' | 'error'

/** Pi's payment callbacks, as the SDK actually calls them. */
interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void
  onReadyForServerCompletion: (paymentId: string, txid: string) => void
  onCancel: (paymentId: string) => void
  onError: (error: Error, payment?: unknown) => void
}
interface PiPaymentData {
  amount: number
  memo: string
  metadata: Record<string, unknown>
}
type PiWithPayments = {
  createPayment?: (data: PiPaymentData, callbacks: PiPaymentCallbacks) => void
}

/** Post one step of the flow to our server, which is the only side that decides. */
async function postStep(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) ?? `Payment step failed (${res.status})`)
  return data
}

/**
 * Subscribe with Pi.
 *
 * The server owns every decision that matters: the amount comes from our plans
 * table, approval and completion are server-verified, and the plan is granted
 * only after completion. This component is the surface — it can start a payment
 * and report what happened, and it cannot grant itself anything.
 */
export function UpgradePanel() {
  const { t } = useI18n()
  const pi = usePiAuthOptional()
  const [plans, setPlans] = useState<PlanDTO[]>([])
  const [current, setCurrent] = useState<'free' | 'pro'>('free')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plans')
      const data = await res.json()
      setPlans(data.plans ?? [])
      setCurrent(data.current ?? 'free')
    } catch {
      /* pricing is not critical to the rest of the page */
    }
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const signedIn = Boolean(pi?.userData)
  const piSdk = (typeof window !== 'undefined' ? (window as unknown as { Pi?: PiWithPayments }).Pi : undefined)
  const canPay = signedIn && typeof piSdk?.createPayment === 'function'

  const buy = (planId: 'free' | 'pro') => {
    if (!canPay || !piSdk?.createPayment) return
    const plan = plans.find((p) => p.id === planId)
    if (!plan) return

    setPhase('creating')
    setMessage(null)

    piSdk.createPayment(
      {
        amount: plan.price.pi,
        memo: `Lambda NX ${plan.name} — 1 ${plan.price.interval}`,
        metadata: { kind: 'subscription', plan: plan.id, interval: plan.price.interval },
      },
      {
        onReadyForServerApproval: (paymentId) => {
          setPhase('approving')
          postStep({ action: 'approve', paymentId }).catch((err: Error) => {
            setPhase('error')
            setMessage(err.message)
          })
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          setPhase('completing')
          postStep({
            action: 'complete',
            paymentId,
            txid,
            metadata: { kind: 'subscription', plan: plan.id },
          })
            .then(async (data) => {
              // Report what the server actually did, not what we hoped: a paid
              // charge whose grant failed must not look like a finished upgrade.
              if (data.granted) {
                setPhase('done')
                setMessage(t('upgrade.done'))
                await loadPlans()
              } else {
                setPhase('error')
                setMessage(t('upgrade.paidNotGranted'))
              }
            })
            .catch((err: Error) => {
              setPhase('error')
              setMessage(err.message)
            })
        },
        onCancel: (paymentId) => {
          setPhase('idle')
          setMessage(t('upgrade.cancelled'))
          postStep({ action: 'cancel', paymentId }).catch(() => {
            /* best effort — Pi already knows it was cancelled */
          })
        },
        onError: (error) => {
          setPhase('error')
          setMessage(error?.message || t('upgrade.failed'))
        },
      },
    )
  }

  const busy = phase === 'creating' || phase === 'approving' || phase === 'completing'
  const phaseLabel: Record<Phase, string> = {
    idle: '',
    creating: t('upgrade.creating'),
    approving: t('upgrade.approving'),
    completing: t('upgrade.completing'),
    done: t('upgrade.done'),
    error: '',
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {t('upgrade.title')}
        </h3>
        <Badge variant={current === 'pro' ? 'default' : 'secondary'} className="text-[10px] uppercase">
          {current}
        </Badge>
      </div>

      <div className="space-y-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === current
          const free = plan.price.pi <= 0
          return (
            <div key={plan.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {free
                      ? t('upgrade.freeForever')
                      : `${plan.price.pi} π / ${plan.price.interval} · ${plan.price.usd} USD`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t('upgrade.limits', {
                      investigations: String(plan.limits.dailyInvestigations),
                      monitors: String(plan.limits.monitors),
                    })}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5" /> {t('upgrade.current')}
                  </span>
                ) : free ? null : (
                  <Button size="sm" className="shrink-0" disabled={!canPay || busy} onClick={() => buy(plan.id)}>
                    {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    {t('upgrade.buy')} π
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {plan.features.map((f) => (
                  <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {busy || phase === 'done' ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {phaseLabel[phase]}
        </p>
      ) : null}

      {message && phase === 'error' ? <p className="mt-3 text-xs text-destructive">{message}</p> : null}

      {/* Say plainly why the button is unavailable, instead of a dead control. */}
      {!canPay ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {signedIn ? t('upgrade.needsPiBrowser') : t('upgrade.needsSignIn')}
        </p>
      ) : null}
    </Card>
  )
}
