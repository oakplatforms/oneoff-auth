import { CognitoIdentityProviderClient, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { PreTokenGenerationTriggerEvent } from 'aws-lambda'
import { fetchData } from '../src/services/api'
import { getAdminPassword } from '../src/utils/secretsManager'

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const userPoolId = process.env.ADMIN_USER_POOL_ID as string
const clientId = process.env.ADMIN_CLIENT_ID as string
const username = 'admin@oakplatforms.com'

export const handler = async (event: PreTokenGenerationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('PreTokenGeneration Trigger Event:', JSON.stringify(event, null, 2))

    if (event.triggerSource !== 'TokenGeneration_NewPasswordChallenge') {
      console.log(`Skipping user creation for trigger source: ${event.triggerSource}`)
      return event
    }

    const userSub = event?.request?.userAttributes?.sub

    const password = await getAdminPassword()

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
    console.error('PreTokenGeneration Error:', error)
    throw error
  }
}