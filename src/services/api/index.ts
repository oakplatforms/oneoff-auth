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

  const response = await fetch(`${process.env.API_BASE_URL}/api/v1${url}`, options)

  if (response.status === 429) {
    throw new RateLimitError('Rate limit exceeded. Stopping further requests.')
  }

  if (!response.ok) {
    const errorData = await response.json() as ErrorResponse
    throw new Error(errorData.errorMessage || errorData.error || `HTTP Error: ${response.status}`)
  }

  return response.json() as Promise<T>
}
