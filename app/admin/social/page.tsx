import type { Metadata } from 'next'
import { SocialDashboard } from '@/components/social-dashboard'

/**
 * The operator's publishing-channel screen. Not linked from anywhere in the
 * product and gated by ADMIN_SECRET, so it is reachable only by someone who
 * already knows both the path and the secret.
 */
export const metadata: Metadata = {
  title: 'Publishing channels — Lambda NX',
  robots: { index: false, follow: false },
}

export default function AdminSocialPage() {
  return (
    <div className="min-h-screen bg-background px-4">
      <SocialDashboard />
    </div>
  )
}
