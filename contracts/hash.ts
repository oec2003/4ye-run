const OMITTED_KEYS = new Set(['version', 'updatedAt', 'status', 'contentHash', 'uploadUrl'])

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter((key) => !OMITTED_KEYS.has(key) && record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableStringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
