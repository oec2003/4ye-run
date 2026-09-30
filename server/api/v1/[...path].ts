import { getQuery, getRouterParam, getRequestHeader, getRequestURL, proxyRequest, setHeader, setResponseStatus, toWebRequest } from 'h3'
import { getLocalContent, getLocalMember, listLocalContents, listLocalMembers } from '../../utils/localContent'

interface ServiceBinding {
  fetch(request: Request): Promise<Response>
}

function apiService(event: Parameters<typeof toWebRequest>[0]): ServiceBinding | undefined {
  const env = event.context.cloudflare?.env as CloudflareEnv | undefined
  return env?.API_SERVICE
}

function requestId(event: Parameters<typeof getRequestHeader>[0]) {
  return getRequestHeader(event, 'x-request-id') || crypto.randomUUID()
}

function fail(event: Parameters<typeof setResponseStatus>[0], status: number, code: string, message: string) {
  setResponseStatus(event, status)
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  return { error: { code, message }, requestId: requestId(event) }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const path = (getRouterParam(event, 'path') || '').replace(/^\/+|\/+$/g, '')

  const service = apiService(event)
  if (service) {
    const incoming = toWebRequest(event)
    const target = new URL(`/api/v1/${path}${getRequestURL(event).search}`, 'https://api.4ye.run')
    return service.fetch(new Request(target, incoming))
  }

  if (config.workerApiBaseUrl) {
    const incoming = getRequestURL(event)
    const target = `${String(config.workerApiBaseUrl).replace(/\/$/, '')}/${path}${incoming.search}`
    return proxyRequest(event, target, {
      streamRequest: true,
      fetchOptions: {
        redirect: 'manual'
      }
    })
  }

  if (event.method !== 'GET') {
    return fail(event, 503, 'WORKER_NOT_CONFIGURED', '本地内容服务只提供公开读取；请配置 WORKER_API_BASE_URL 使用发布接口。')
  }

  const query = Object.fromEntries(Object.entries(getQuery(event)).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : value == null ? undefined : String(value)]))
  const segments = path.split('/').filter(Boolean)
  setHeader(event, 'cache-control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=60')

  if (path === 'health') {
    return { data: { status: 'ok', source: 'local-fixture' }, requestId: requestId(event) }
  }
  if (segments[0] === 'reports') {
    if (segments.length === 1) {
      const result = listLocalContents('report', query)
      return { ...result, requestId: requestId(event) }
    }
    const item = getLocalContent('report', segments[1])
    return item ? { data: item, requestId: requestId(event) } : fail(event, 404, 'NOT_FOUND', '未找到这期周报。')
  }
  if (segments[0] === 'essays') {
    if (segments.length === 1) {
      const result = listLocalContents('essay', query)
      return { ...result, requestId: requestId(event) }
    }
    const item = getLocalContent('essay', segments[1])
    return item ? { data: item, requestId: requestId(event) } : fail(event, 404, 'NOT_FOUND', '未找到这篇小作文。')
  }
  if (segments[0] === 'members') {
    if (segments.length === 1) {
      const result = listLocalMembers(query)
      return { ...result, requestId: requestId(event) }
    }
    const item = getLocalMember(segments[1])
    return item ? { data: item, requestId: requestId(event) } : fail(event, 404, 'NOT_FOUND', '未找到这位跑友。')
  }
  return fail(event, 404, 'NOT_FOUND', '接口不存在。')
})
