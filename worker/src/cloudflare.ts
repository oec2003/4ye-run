export interface D1Result<T = Record<string, unknown>> {
  success: boolean
  results?: T[]
  meta?: { changes?: number; last_row_id?: number }
  error?: string
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>
}

export interface R2Bucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface Env {
  DB: D1Database
  ASSETS: R2Bucket
  PUBLISH_TOKEN: string
  ASSET_PUBLIC_BASE_URL: string
  ALLOWED_WEB_ORIGIN?: string
  MAX_ASSET_SIZE_BYTES?: string
  PUBLIC_RATE_LIMITER?: RateLimitBinding
}

export type D1Row = Record<string, string | number | null>
