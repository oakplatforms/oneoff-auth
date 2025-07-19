import { PostConfirmationTriggerEvent } from 'aws-lambda'
import https from 'https'

const defaultOptions = {
  host: process.env.HOST_NAME,
  port: 443,
}

const get = (path: string) =>
  new Promise((resolve, reject) => {
    const options = {
      ...defaultOptions,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
    const req = https.request(options, (res) => {
      let buffer = ''
      res.on('data', (chunk) => (buffer += chunk))
      res.on('end', () => resolve(JSON.parse(buffer)))
    })
    req.on('error', (e) => reject(e.message))
    req.end()
  })

const post = (path: string, payload: unknown, sessionToken: string) =>
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

export const handler = async (event: PostConfirmationTriggerEvent) => {
  try {
    console.log('PostConfirmation Trigger Event:', JSON.stringify(event, null, 2))

    const userSub = event?.request?.userAttributes?.sub
    if (!userSub) {
      throw new Error("User 'sub' not found in attributes")
    }

    const guestTokenResponse = await get('/user/guest-token') as { token: string }
    const sessionToken = guestTokenResponse.token

    if (!sessionToken) {
      throw new Error('Failed to retrieve guest token')
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