/**
 * Ghost recovery: one owner-only secret word that unlocks the admin PIN reset.
 *
 * How it works:
 *  - The owner sets ONE secret ghost word inside the app (Admin Panel).
 *  - Only its fingerprint (hash) is ever stored — never the word itself.
 *  - Login screen has a small "Forgot PIN?" corner link. It asks ONLY for
 *    the ghost word (no phone, no SMS, no Supabase needed).
 *  - Correct word (5 tries → 60s lockout) → set a new admin PIN → audit log.
 *
 * The word can be letters, numbers, or both (e.g. "jumpjet").
 * If the ghost word itself is lost, the last resort is a fresh reinstall
 * seed — there is intentionally no second backdoor.
 */

const ATTEMPT_KEY = 'cafe_ghost_attempts';

function fnv(input: string): string {
  let h1 = 14695981039346656037n;
  let h2 = 1099511628211n;
  for (let i = 0; i < input.length; i++) {
    h1 ^= BigInt(input.charCodeAt(i));
    h1 = (h1 * 1099511628211n) & 0xffffffffffffffffn;
    h2 ^= BigInt(input.charCodeAt(input.length - 1 - i) + i);
    h2 = (h2 * 1099511628211n) & 0xffffffffffffffffn;
  }
  return h1.toString(16).padStart(16, '0') + h2.toString(16).padStart(16, '0');
}

/** Fingerprint of the ghost word. Same fnv pair style as PIN hashing. */
export function hashGhostWord(word: string): string {
  return fnv(`ghost:${word.trim().toLowerCase()}`);
}

export function ghostMatches(stored: string | null | undefined, entered: string): boolean {
  if (!stored) return false;
  const clean = entered.trim().toLowerCase();
  if (clean.length < 4) return false;
  return stored.toLowerCase() === hashGhostWord(clean).toLowerCase();
}

export function isValidGhostWord(raw: string): boolean {
  const clean = raw.trim();
  // Letters and/or numbers, 4–32 chars, no spaces (easy to type on login).
  return /^[A-Za-z0-9]{4,32}$/.test(clean);
}

export function isGhostSet(stored: string | null | undefined): boolean {
  return !!stored && stored.length >= 16;
}

export type GhostVerifyResult = { ok: boolean; error?: 'mismatch' | 'locked' | 'missing' };

export function verifyGhostWord(stored: string | null | undefined, entered: string): GhostVerifyResult {
  try {
    const aRaw = localStorage.getItem(ATTEMPT_KEY);
    if (aRaw) {
      const a = JSON.parse(aRaw) as { n: number; until: number };
      if (Date.now() < a.until) return { ok: false, error: 'locked' };
    }
  } catch { /* ignore */ }

  const fail = (err: GhostVerifyResult['error']): GhostVerifyResult => {
    try {
      const aRaw = localStorage.getItem(ATTEMPT_KEY);
      const a = aRaw ? (JSON.parse(aRaw) as { n: number; until: number }) : { n: 0, until: 0 };
      const n = (err === 'mismatch' ? a.n + 1 : a.n);
      if (n >= 5) {
        localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ n: 0, until: Date.now() + 60000 }));
        return { ok: false, error: 'locked' };
      }
      localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ n, until: 0 }));
    } catch { /* ignore */ }
    return { ok: false, error: err };
  };

  if (!isGhostSet(stored)) return fail('missing');
  if (!ghostMatches(stored, entered)) return fail('mismatch');
  try { localStorage.removeItem(ATTEMPT_KEY); } catch { /* ignore */ }
  return { ok: true };
}

export function clearGhostAttempts(): void {
  try { localStorage.removeItem(ATTEMPT_KEY); } catch { /* ignore */ }
}

/** Legacy SMS helpers kept for reference — unused by the ghost flow. */
export function normalizePhone(raw: string): string {
  const t = raw.trim().replace(/[\s\-().]/g, '');
  if (t.startsWith('+')) return '+' + t.slice(1).replace(/\D/g, '');
  return t.replace(/\D/g, '');
}

export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  return /^\+\d{7,15}$/.test(p);
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const p = phone.trim();
  if (p.length <= 5) return '•••••';
  return p.slice(0, 4) + '••••••••'.slice(0, Math.max(0, p.length - 6)) + p.slice(-2);
}

export function isSupabaseConfigured(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
    return !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}

export const isDev = (() => {
  try {
    return !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  } catch {
    return false;
  }
})();
