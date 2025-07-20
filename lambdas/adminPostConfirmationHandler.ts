import { CognitoIdentityProviderClient, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { PostConfirmationTriggerEvent } from 'aws-lambda'
import { fetchData } from '../src/services/api'

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const userPoolId = process.env.ADMIN_USER_POOL_ID as string
const clientId = process.env.ADMIN_CLIENT_ID as string
const username = process.env.DEFAULT_USERNAME as string
const password = process.env.DEFAULT_PASSWORD as string

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
    const sessionToken = authResponse.AuthenticationResult?.AccessToken
    if (!sessionToken) {
      throw new Error('Failed to retrieve session token')
    }
    await fetchData({
      url: '/user',
      method: 'POST',
      payload: {
        authId: userSub,
        isAdmin: true,
        admin: {
          email: event?.request?.userAttributes?.email,
        },
      },
      token: sessionToken,
    })

    return event
  } catch (error) {
    console.error('PostConfirmation Error:', error)
    throw error
  }
}