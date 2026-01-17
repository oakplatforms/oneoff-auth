import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import type { PreTokenGenerationTriggerEvent } from 'aws-lambda'

const eventBridge = new EventBridgeClient({ region: 'us-east-1' })

export const handler = async (event: PreTokenGenerationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('Forgot Password Trigger Event:', JSON.stringify(event, null, 2))

    const userSub = event?.request?.userAttributes?.sub
    if (!userSub) {
      throw new Error("User 'sub' not found in attributes")
    }

    //Send EventBridge event for forgot password
    await eventBridge.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'oneoff',
          DetailType: 'user.forgot-password',
          Detail: JSON.stringify({
            userId: userSub,
            email: event?.request?.userAttributes?.email,
            type: 'user.forgot-password'
          }),
          EventBusName: 'default',
        },
      ],
    }))

    return event
  } catch (error) {
    console.error('Forgot Password Error:', error)
    throw error
  }
} 