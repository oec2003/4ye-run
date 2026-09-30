PRAGMA foreign_keys = ON;

CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('report', 'essay')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('markdown', 'image')),
  body_markdown TEXT NOT NULL,
  cover_asset_id TEXT REFERENCES assets(id),
  poster_asset_id TEXT REFERENCES assets(id),
  author_member_id TEXT REFERENCES members(id),
  author_display_name TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  period_start TEXT,
  period_end TEXT,
  stats_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('published', 'unpublished')),
  version INTEGER NOT NULL CHECK (version > 0),
  content_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_key TEXT UNIQUE,
  source_record_json TEXT
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_asset_id TEXT REFERENCES assets(id),
  bio TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('published', 'unpublished')),
  version INTEGER NOT NULL CHECK (version > 0),
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE member_accounts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('xiaoyuzhou', 'xiaohongshu', 'wechat_official', 'website', 'other')),
  account_name TEXT NOT NULL,
  account_id TEXT,
  url TEXT,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE contributors (
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES members(id),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (content_id, sort_order)
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready')),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_assets_ready_sha256 ON assets(sha256) WHERE status = 'ready';

CREATE TABLE content_assets (
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  role TEXT NOT NULL CHECK (role IN ('cover', 'poster', 'body')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (content_id, asset_id, role)
);

CREATE TABLE revisions (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('content', 'member')),
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  operator TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, version)
);

CREATE TABLE idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_contents_public_list ON contents(type, status, published_at DESC, id DESC);
CREATE INDEX idx_contents_period ON contents(type, status, period_start, period_end);
CREATE INDEX idx_members_public_list ON members(status, sort_order, id);
CREATE INDEX idx_member_accounts_member ON member_accounts(member_id, sort_order, id);
CREATE INDEX idx_member_accounts_platform ON member_accounts(platform, member_id);
CREATE INDEX idx_contributors_content ON contributors(content_id, sort_order);
CREATE INDEX idx_content_assets_content ON content_assets(content_id, sort_order);
CREATE INDEX idx_revisions_entity ON revisions(entity_type, entity_id, version DESC);
CREATE INDEX idx_idempotency_created ON idempotency_records(created_at);
