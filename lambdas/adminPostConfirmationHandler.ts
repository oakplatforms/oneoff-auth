import { CognitoIdentityProviderClient, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import https from 'https'
import type { IncomingMessage } from 'http'
import type { PostConfirmationTriggerEvent } from 'aws-lambda'

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const defaultOptions = {
  host: process.env.API_BASE_URL as string,
  port: 443,
}

const userPoolId = process.env.USER_POOL_ID as string
const clientId = process.env.APP_CLIENT_ID as string
const username = process.env.DEFAULT_USERNAME as string
const password = process.env.DEFAULT_PASSWORD as string

const post = (path: string, payload: unknown, sessionToken: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const options = {
      ...defaultOptions,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken
      },
    }
    const req = https.request(options, (res: IncomingMessage) => {
      let buffer = ''
      res.on('data', (chunk: Buffer) => (buffer += chunk.toString()))
      res.on('end', () => resolve(JSON.parse(buffer)))
    })
    req.on('error', (e: Error) => reject(e.message))
    req.write(JSON.stringify(payload))
    req.end()
  })

export const handler = async (event: PostConfirmationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('PostConfirmation Trigger Event:', JSON.stringify(event, null, 2))

    const userSub = event?.request?.userAttributes?.sub
    if (!userSub) {
      throw new Error("User 'sub' not found in attributes")
    }

    const authResponse = await cognitoClient.send(
      new AdminInitiateAuthCommand({
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      })
    )

    console.log('Auth Response:', JSON.stringify(authResponse, null, 2))

    const sessionToken = authResponse.AuthenticationResult?.AccessToken
    if (!sessionToken) {
      console.error('AuthenticationResult:', authResponse.AuthenticationResult)
      console.error('ChallengeName:', authResponse.ChallengeName)
      console.error('Session:', authResponse.Session)
      throw new Error('Failed to retrieve session token')
    }

    await post('/api/v1/user', {
      'authId': userSub,
      'isAdmin': true,
      'admin': {
        'email': event?.request?.userAttributes?.email,
      }
    }, sessionToken)

    return event
  } catch (error) {
    console.error('PostConfirmation Error:', error)
    throw error
  }
}