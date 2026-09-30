import type { Env } from './cloudflare'
import { handleAdmin } from './admin'
import { ApiError, corsHeaders, failure, json, requireAdmin } from './helpers'
import { handlePublic } from './public'

function applyCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, String(value))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const providedId = request.headers.get('x-request-id') || ''
    const requestId = /^[A-Za-z0-9._:-]{8,128}$/.test(providedId) ? providedId : crypto.randomUUID()
    try {
      if (request.method === 'OPTIONS') return applyCors(new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }), request, env)
      const url = new URL(request.url)
      const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
      if (segments[0] !== 'api' || segments[1] !== 'v1') throw new ApiError(404, 'NOT_FOUND', '接口不存在。')
      const route = segments.slice(2)
      let response: Response
      if (route[0] === 'admin') {
        requireAdmin(request, env)
        response = await handleAdmin(request, env, route, requestId)
      } else {
        if (env.PUBLIC_RATE_LIMITER) {
          const limited = await env.PUBLIC_RATE_LIMITER.limit({ key: `public:${route[0] || 'root'}` })
          if (!limited.success) throw new ApiError(429, 'RATE_LIMITED', '请求过于频繁，请稍后重试。')
        }
        response = await handlePublic(request, env, route, requestId)
      }
      return applyCors(response, request, env)
    } catch (error) {
      console.error(JSON.stringify({ requestId, method: request.method, path: new URL(request.url).pathname, code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR' }))
      return applyCors(failure(error instanceof Error ? error : new Error('unknown error'), requestId), request, env)
    }
  }
}
