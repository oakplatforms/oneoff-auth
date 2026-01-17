import type { PreTokenGenerationTriggerEvent } from 'aws-lambda'

export const handler = async (event: PreTokenGenerationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('Change Password Trigger Event:', JSON.stringify(event, null, 2))

    const userSub = event?.request?.userAttributes?.sub
    if (!userSub) {
      throw new Error("User 'sub' not found in attributes")
    }

    return event
  } catch (error) {
    console.error('Change Password Error:', error)
    throw error
  }
}
