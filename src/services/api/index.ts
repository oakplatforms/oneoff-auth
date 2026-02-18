type FetchProps = {
  url: string
  method?: string
  payload?: object
  token?: string
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

type ErrorResponse = {
  errorMessage?: string
  error?: string
}

export async function fetchData<T>({ url, method = 'GET', payload, token }: FetchProps): Promise<T> {
  //Validate API_BASE_URL environment variable
  if (!process.env.API_BASE_URL) {
    throw new Error('API_BASE_URL environment variable is not set')
  }

  //Validate API_BASE_URL is a valid URL
  try {
    new URL(process.env.API_BASE_URL)
  } catch {
    throw new Error(`Invalid API_BASE_URL: ${process.env.API_BASE_URL}`)
  }

  //Ensure API_BASE_URL doesn't end with a slash to avoid double slashes
  const baseUrl = process.env.API_BASE_URL.endsWith('/')
    ? process.env.API_BASE_URL.slice(0, -1)
    : process.env.API_BASE_URL

  //Ensure url starts with a slash
  const apiPath = url.startsWith('/') ? url : `/${url}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const options = {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  }

  const fullUrl = `${baseUrl}${apiPath}`
  console.log('Making request to:', fullUrl)

  //Validate the final URL before making the request
  try {
    new URL(fullUrl)
  } catch {
    throw new Error(`Invalid URL constructed: ${fullUrl}`)
  }

  const response = await fetch(fullUrl, options)

  if (response.status === 429) {
    throw new RateLimitError('Rate limit exceeded. Stopping further requests.')
  }

  if (!response.ok) {
    const errorData = await response.json() as ErrorResponse
    throw new Error(errorData.errorMessage || errorData.error || `HTTP Error: ${response.status}`)
  }

  return response.json() as Promise<T>
}
