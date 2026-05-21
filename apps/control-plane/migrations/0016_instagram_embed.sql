-- =============================================================================
-- 0016_instagram_embed.sql — Track 24f-5 Instagram auto-sync (hybrid embed)
-- =============================================================================
-- Stores klient's Instagram embed config (iframe URL or HTML).
-- Klient pastes URL from SnapWidget / Lightwidget / etc. — we render iframe.
-- =============================================================================

CREATE TABLE instagram_embed_config (
  client_id        TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  embed_type       TEXT NOT NULL DEFAULT 'iframe_url' CHECK (embed_type IN ('iframe_url', 'iframe_html')),
  embed_url        TEXT,
  embed_html       TEXT,
  display_layout   TEXT NOT NULL DEFAULT 'grid' CHECK (display_layout IN ('grid', 'carousel', 'masonry')),
  display_count    INTEGER NOT NULL DEFAULT 9,
  section_title    TEXT DEFAULT 'Instagram',
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
