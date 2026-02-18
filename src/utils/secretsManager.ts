import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

export interface OneoffAuthSecrets {
  adminPassword: string
  consumerPassword: string
}

interface CachedSecret {
  secret: OneoffAuthSecrets
  fetchedAt: number
}

let cachedSecret: CachedSecret | null = null

// Cache TTL of 30 minutes - ensures credentials refresh before rotation completes
const CACHE_TTL_MS = 30 * 60 * 1000

/**
 * Fetches secrets from AWS Secrets Manager with caching
 */
export async function getSecrets(): Promise<OneoffAuthSecrets> {
  const now = Date.now()

  // Return cached if still valid
  if (cachedSecret && (now - cachedSecret.fetchedAt) < CACHE_TTL_MS) {
    console.log('[SecretsManager] Using cached secrets')
    return cachedSecret.secret
  }

  const client = new SecretsManagerClient({ region: 'us-east-1' })
  const secretName = `oneoff-credentials-${process.env.STAGE || 'dev'}`

  console.log(`[SecretsManager] Fetching secret: ${secretName}`)

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  )

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no SecretString`)
  }

  const fullSecret = JSON.parse(response.SecretString)

  const secret: OneoffAuthSecrets = {
    adminPassword: fullSecret.adminPassword,
    consumerPassword: fullSecret.consumerPassword
  }

  console.log('[SecretsManager] Successfully fetched auth passwords')

  cachedSecret = {
    secret,
    fetchedAt: now
  }

  return secret
}

/**
 * Get the admin password from Secrets Manager
 */
export async function getAdminPassword(): Promise<string> {
  const secrets = await getSecrets()
  return secrets.adminPassword
}

/**
 * Get the consumer password from Secrets Manager
 */
export async function getConsumerPassword(): Promise<string> {
  const secrets = await getSecrets()
  return secrets.consumerPassword
}

// Clear the cache - useful for retry logic on auth failures
export function clearSecretsCache(): void {
  cachedSecret = null
}
