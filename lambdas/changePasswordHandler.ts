import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import type { PreTokenGenerationTriggerEvent } from 'aws-lambda'

const eventBridge = new EventBridgeClient({ region: 'us-east-1' })

export const handler = async (event: PreTokenGenerationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('Change Password Trigger Event:', JSON.stringify(event, null, 2))

    const userSub = event?.request?.userAttributes?.sub
    if (!userSub) {
      throw new Error("User 'sub' not found in attributes")
    }

    //Send EventBridge event for password change
    await eventBridge.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'tcgx',
          DetailType: 'user.password-changed',
          Detail: JSON.stringify({
            userId: userSub,
            email: event?.request?.userAttributes?.email,
            type: 'user.password-changed'
          }),
          EventBusName: 'default',
        },
      ],
    }))

    return event
  } catch (error) {
    console.error('Change Password Error:', error)
    throw error
  }
}
