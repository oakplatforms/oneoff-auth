import { CognitoIdentityProviderClient, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import https from 'https'

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const defaultOptions = {
  host: process.env.API_BASE_URL,
  port: 443,
}

const userPoolId = process.env.USER_POOL_ID
const clientId = process.env.APP_CLIENT_ID
const username = process.env.DEFAULT_USERNAME
const password = process.env.DEFAULT_PASSWORD

const post = (path, payload, sessionToken) =>
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
    const req = https.request(options, (res) => {
      let buffer = ''
      res.on('data', (chunk) => (buffer += chunk))
      res.on('end', () => resolve(JSON.parse(buffer)))
    })
    req.on('error', (e) => reject(e.message))
    req.write(JSON.stringify(payload))
    req.end()
  })

exports.handler = async (event) => {
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

    const sessionToken = authResponse.AuthenticationResult?.AccessToken
    if (!sessionToken) {
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