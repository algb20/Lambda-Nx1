/**
 * Standalone (off-Pi) auth: first-party email + password. Produces the same
 * signed session as Pi login, so the rest of the app is identical in both modes
 * (charter rule #4). Dependency-injected → testable without a database.
 */
import { hashPassword, verifyPassword } from './password'

export interface StandaloneDeps {
  findByEmail: (email: string) => Promise<{ userId: string; passwordHash: string } | undefined>
  createUserAndCredential: (email: string, passwordHash: string) => Promise<{ userId: string }>
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function registerUser(
  email: string,
  password: string,
  deps: StandaloneDeps,
): Promise<{ userId: string }> {
  const normEmail = normalizeEmail(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) throw new Error('Invalid email address')
  if (password.length < 8) throw new Error('Password must be at least 8 characters')
  if (await deps.findByEmail(normEmail)) throw new Error('Email already registered')
  return deps.createUserAndCredential(normEmail, hashPassword(password))
}

export async function loginUser(
  email: string,
  password: string,
  deps: StandaloneDeps,
): Promise<{ userId: string }> {
  const cred = await deps.findByEmail(normalizeEmail(email))
  if (!cred || !verifyPassword(password, cred.passwordHash)) {
    throw new Error('Invalid email or password')
  }
  return { userId: cred.userId }
}
