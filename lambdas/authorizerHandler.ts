import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import type { APIGatewayAuthorizerEvent } from 'aws-lambda'

const COGNITO_REGION = 'us-east-1'
const USER_POOLS = {
  admin: process.env.ADMIN_USER_POOL_ID,
  clientApps: process.env.CLIENT_APPS_USER_POOL_ID,
}
const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET

function getJwksUrl(userPoolId: string) {
  return `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
}

async function getPublicKey(kid: string, jwksUrl: string) {
  const client = jwksClient({ jwksUri: jwksUrl })
  const key = await client.getSigningKey(kid)
  return key.getPublicKey()
}

function deny(resource: string) {
  return {
    principalId: 'unauthorized',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: resource,
        },
      ],
    },
    context: {},
  }
}

function generatePolicy(
  principalId: string,
  effect: string,
  resource: string,
  context: Record<string, unknown> = {}
) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  }
}

export async function handler(event: APIGatewayAuthorizerEvent) {
  try {
    const isTokenEvent = event.type === 'TOKEN'

    const token = isTokenEvent
      ? event.authorizationToken?.split(' ')[1]
      : event.headers?.Authorization?.split(' ')[1] || event.headers?.authorization?.split(' ')[1]

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routeArn = (event as any).methodArn || (event as any).routeArn
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const method = (event as any).requestContext?.http?.method || (event as any).httpMethod || 'GET'

    if (!token) {
      console.warn('Missing token')
      return deny(routeArn)
    }

    const decodedHeader = jwt.decode(token, { complete: true }) as { header?: { alg?: string; kid?: string } } | null
    if (!decodedHeader?.header) {
      console.warn('Malformed token, no header')
      return deny(routeArn)
    }

    const alg = decodedHeader.header.alg

    if (alg === 'HS256') {
      try {
        if (!TEMP_JWT_SECRET) throw new Error('TEMP_JWT_SECRET not configured')
        const decodedGuest = jwt.verify(token, TEMP_JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload
        if (decodedGuest?.role === 'guest') {
          //Guest users can only make GET requests to read-only endpoints
          if (method !== 'GET') {
            console.warn(`Guest user attempted ${method} request - denied`)
            return deny(routeArn)
          }

          return generatePolicy('guest', 'Allow', routeArn, {
            role: 'guest',
            userPool: 'temporary',
          })
        } else {
          console.warn('Invalid guest token role')
          return deny(routeArn)
        }
      } catch (err) {
        const error = err as Error
        console.error('Guest token verification failed:', error.message)
        return deny(routeArn)
      }
    }

    //🔐 Cognito token
    const decodedPayload = jwt.decode(token) as jwt.JwtPayload | null
    const issuer = decodedPayload?.iss
    if (!issuer) throw new Error('Issuer not found in token')

    let userPoolId: string | undefined
    if (issuer === `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOLS.admin}`) {
      userPoolId = USER_POOLS.admin
    } else if (issuer === `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOLS.clientApps}`) {
      userPoolId = USER_POOLS.clientApps
    } else {
      throw new Error('Unknown issuer')
    }

    const jwksUrl = getJwksUrl(userPoolId as string)
    const publicKey = await getPublicKey(decodedHeader.header.kid as string, jwksUrl)
    const decodedUser = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload

    let role = (decodedUser['custom:role'] as string) || 'user'
    if (userPoolId === USER_POOLS.admin) role = 'admin'
    if (userPoolId === USER_POOLS.clientApps) role = 'customer'

    return generatePolicy(decodedUser.sub as string, 'Allow', routeArn, { role, userPool: userPoolId })
  } catch (error) {
    const err = error as Error
    console.error('Authorization Error:', err.message)
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deny((event as any).methodArn || (event as any).routeArn || '*')
  }
}