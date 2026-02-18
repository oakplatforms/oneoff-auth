import { CognitoIdentityProviderClient, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { PostConfirmationTriggerEvent } from 'aws-lambda'
import { fetchData } from '../src/services/api'

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const userPoolId = process.env.CONSUMER_USER_POOL_ID as string
const clientId = process.env.CONSUMER_CLIENT_ID as string
const username = process.env.CONSUMER_DEFAULT_USERNAME as string
const password = process.env.CONSUMER_DEFAULT_PASSWORD as string

export const handler = async (event: PostConfirmationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('PostConfirmation Trigger Event:', JSON.stringify(event, null, 2))

    if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
      console.log(`Skipping post confirmation logic for trigger source: ${event.triggerSource}`)
      return event
    }

    const userSub = event?.request?.userAttributes?.sub

    //Use admin user to authenticate and create user record
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
        account: {
          email: event?.request?.userAttributes?.email,
          type: 'REGISTERED',
          profile: {},
          carts: [{}],
          lists: [
            {
              name: 'collection',
              displayName: 'Collection',
              type: 'COLLECTION',
              isPrivate: true
            }
          ]
        }
      },
      token: sessionToken,
    })

    return event
  } catch (error) {
    console.error('PostConfirmation Error:', error)
    throw error
  }
}