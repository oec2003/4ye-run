type RuntimeD1Database = D1Database
type RuntimeD1PreparedStatement = D1PreparedStatement

// Cloudflare binding types are generated from worker/wrangler.jsonc by
// `yarn types:api`; this file only gives application code stable aliases.
export type Env = ApiEnv & { PUBLISH_TOKEN: string }
export type { RuntimeD1Database as D1Database, RuntimeD1PreparedStatement as D1PreparedStatement }

export type D1Row = Record<string, string | number | null>
