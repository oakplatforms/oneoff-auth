import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const COGNITO_REGION = 'us-east-1'
const USER_POOLS = {
  admin: process.env.ADMIN_USER_POOL_ID,
  clientApps: process.env.CLIENT_APPS_USER_POOL_ID,
}
const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET

function getJwksUrl(userPoolId) {
  return `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
}

async function getPublicKey(kid, jwksUrl) {
  const client = jwksClient({ jwksUri: jwksUrl })
  const key = await client.getSigningKey(kid)
  return key.getPublicKey()
}

function deny(resource) {
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

function generatePolicy(principalId, effect, resource, context = {}) {
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

export async function handler(event) {
  try {
    const isTokenEvent = event.type === 'TOKEN'

    const token = isTokenEvent
      ? event.authorizationToken?.split(' ')[1]
      : event.headers?.Authorization?.split(' ')[1] || event.headers?.authorization?.split(' ')[1]

    const routeArn = event.methodArn || event.routeArn
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET'

    if (!token) {
      console.warn('Missing token')
      return deny(routeArn)
    }

    const decodedHeader = jwt.decode(token, { complete: true })
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
        console.error('Guest token verification failed:', err.message)
        return deny(routeArn)
      }
    }

    //🔐 Cognito token
    const decodedPayload = jwt.decode(token) as jwt.JwtPayload
    const issuer = decodedPayload?.iss
    if (!issuer) throw new Error('Issuer not found in token')

    let userPoolId
    if (issuer === `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOLS.admin}`) {
      userPoolId = USER_POOLS.admin
    } else if (issuer === `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOLS.clientApps}`) {
      userPoolId = USER_POOLS.clientApps
    } else {
      throw new Error('Unknown issuer')
    }

    const jwksUrl = getJwksUrl(userPoolId)
    const publicKey = await getPublicKey(decodedHeader.header.kid, jwksUrl)
    const decodedUser = jwt.verify(token, publicKey, { algorithms: ['RS256'] })

    let role = decodedUser['custom:role'] || 'user'
    if (userPoolId === USER_POOLS.admin) role = 'admin'
    if (userPoolId === USER_POOLS.clientApps) role = 'customer'

    return generatePolicy(decodedUser.sub, 'Allow', routeArn, { role, userPool: userPoolId })
  } catch (error) {
    console.error('Authorization Error:', error.message)
    return deny(event.methodArn || event.routeArn || '*')
  }
}