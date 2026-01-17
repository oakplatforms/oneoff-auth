import type { PreTokenGenerationTriggerEvent } from 'aws-lambda'

export const handler = async (event: PreTokenGenerationTriggerEvent): Promise<typeof event> => {
  try {
    console.log('Forgot Password Trigger Event:', JSON.stringify(event, null, 2))

    const userSub = event?.request?.userAttributes?.sub
    if (!userSub) {
      throw new Error("User 'sub' not found in attributes")
    }

    return event
  } catch (error) {
    console.error('Forgot Password Error:', error)
    throw error
  }
} 