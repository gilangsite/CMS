import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export type OAuthProvider = 'instagram' | 'tiktok'

export interface OAuthStatePayload {
  workspaceId: string
  userId: string
  provider: OAuthProvider
  issuedAt: number
  nonce: string
}

function stateSecret(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is required for OAuth state signing')
  return Buffer.from(secret, 'utf8')
}

export function createOAuthState(input: {
  workspaceId: string
  userId: string
  provider: OAuthProvider
}): string {
  const payload: OAuthStatePayload = {
    ...input,
    issuedAt: Date.now(),
    nonce: randomBytes(16).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', stateSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyOAuthState(
  state: string,
  expectedProvider: OAuthProvider,
  maxAgeMs = 10 * 60 * 1000
): OAuthStatePayload {
  const [encoded, receivedSignature] = state.split('.')
  if (!encoded || !receivedSignature) throw new Error('Invalid OAuth state')

  const expectedSignature = createHmac('sha256', stateSecret()).update(encoded).digest()
  const received = Buffer.from(receivedSignature, 'base64url')
  if (
    received.length !== expectedSignature.length ||
    !timingSafeEqual(received, expectedSignature)
  ) {
    throw new Error('Invalid OAuth state signature')
  }

  const payload = JSON.parse(
    Buffer.from(encoded, 'base64url').toString('utf8')
  ) as OAuthStatePayload
  if (
    payload.provider !== expectedProvider ||
    typeof payload.workspaceId !== 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.issuedAt !== 'number' ||
    Date.now() - payload.issuedAt > maxAgeMs ||
    payload.issuedAt > Date.now() + 60_000
  ) {
    throw new Error('OAuth state is expired or invalid')
  }
  return payload
}
