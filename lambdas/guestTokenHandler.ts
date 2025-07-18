import { APIGatewayProxyResult } from 'aws-lambda'
import jwt from 'jsonwebtoken'

const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET

export const handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    if (!TEMP_JWT_SECRET) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        },
        body: JSON.stringify({ error: 'TEMP_JWT_SECRET not configured' })
      }
    }

    const payload = {
      role: 'guest',
      permissions: ['read-only'],
      exp: Math.floor(Date.now() / 1000) + 900
    }

    const token = jwt.sign(payload, TEMP_JWT_SECRET, { algorithm: 'HS256' })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ token })
    }
  } catch (err) {
    console.error('Failed to generate guest token', err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ error: 'Could not generate guest token' })
    }
  }
}
