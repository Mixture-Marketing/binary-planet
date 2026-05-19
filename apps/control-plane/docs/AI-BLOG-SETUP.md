# AI Blog setup — Track 8

## 1. Anthropic API key

1. Załóż konto: **https://console.anthropic.com/**
2. Doładuj kredyt (Settings → Billing → Add to balance) — min $20 dla startu
3. **Settings → API Keys → Create Key** — nazwa "MixtureMarketing control-plane"
4. Skopiuj — pojawi się **tylko raz**

Wpisz do `.dev.vars`:
```
ANTHROPIC_API_KEY="sk-ant-..."
BLOG_AI_DRY_RUN="false"
```

## 2. Sanity check

```powershell
cd D:\KOD\binary-planet\apps\control-plane
node --env-file=.dev.vars scripts/verify-anthropic.mjs
```

Oczekiwany output:
```
Anthropic API check

  POST /v1/messages (haiku — minimal ping) ... OK (model=claude-haiku-4-5-20251001 · in=12t out=2t · "PING")
  Sonnet 4.6 reachable ... OK (usage in=8t out=4t)

ALL CHECKS PASSED
```

## 3. Włącz `blog_ai` dla klienta

```sql
UPDATE clients SET modules_json = '["care","blog_ai"]' WHERE id = 'clk_kowalski';
```

Lub przez admin → klient detail → edytuj moduły (TBD UI w v0.2).

## 4. Co dzieje się w produkcji

```
Cron 0 8 * * 1 (każdy poniedziałek 8:00)
  → SELECT klientów (status='active', modules_json LIKE '%blog_ai%', github_repo_url NOT NULL)
  → Per klient:
      jeśli ostatni draft < 14 dni temu → SKIP
      → Claude Haiku: 3 propozycje tematów (cheap ~$0.003)
      → Pick best (heurystyka: pierwszy)
      → Claude Sonnet 4.6: pełen draft 500-800 słów (~$0.05-0.10)
      → GitHub: branch ai-blog/{date}-{slug} → commit apps/starter/content/posts/{date}-{slug}.md → open PR
      → audit_log ai_blog.draft_opened + ai_calls cost tracking
```

Klient widzi PR w GitHub UI swojego repo (lub w panelu klienta v0.2 — `/blog/propozycje`).

## 5. Klient flow (review + publish)

1. Email: "Mam dla Ciebie nowy draft" (TBD v0.2 — Resend integration)
2. Klient otwiera PR w GitHub
3. Czyta draft + edytuje jeśli coś wymaga korekty
4. Zmienia `published: false` → `published: true` w frontmatter
5. Merge PR → Cloudflare Pages auto-deploy → strona ma nowy post

## 6. Koszt per post (estymata)

| Model | Input | Output | Koszt USD | Koszt PLN |
|-------|-------|--------|-----------|-----------|
| Haiku (topic) | ~500 t | ~300 t | $0.0016 | ~0.7 gr |
| Sonnet (draft) | ~800 t | ~2000 t | $0.0324 | ~13 gr |
| **Razem** | | | **~$0.034** | **~14 gr** |

Per klient z modułem `blog_ai`, 2 posty/mc = **~30 gr/mc kosztu AI** (Anthropic).

## 7. Budget guards (TBD v0.2)

Track 8-prod doda:
- Per-klient miesięczny budget cap (np. $5/mc dla blog_ai) — gate w `generateSingleDraft`
- Per-platform kill switch (`CONFIG` KV: `blog_ai_disabled = true`) — emergency stop
- Alert P2 jeśli daily AI spend > $50

Na razie polegamy na samym module gate + bi-weekly throttling.

## 8. Produkcja — secrety

```powershell
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler secret put ANTHROPIC_API_KEY      # sk-ant-...
pnpm exec wrangler secret put BLOG_AI_DRY_RUN        # false
```

`GITHUB_PAT` musi mieć scope `repo` (publiczne + prywatne repo, write access). Już ustawione dla Track 4.

## 9. Customizacja per-branża

`apps/control-plane/src/lib/blog/prompts.ts` — `INDUSTRY_CONFIGS` map ma 16 wbudowanych branż (locksmith, auto_repair, beauty, dentist, lawyer, restaurant, etc.).

Każda branża ma:
- **persona** — kto pisze (system prompt tone-setter)
- **topicSeeds** — fallback pomysły (Claude przeważnie generuje lepsze, te są tylko safety net)
- **styleRules** — co unikać (np. dentist: bez konkretnych diagnoz; lawyer: bez konkretnej porady)

Edycja: PR w repo binary-planet, nie wymaga deploy klienta — zmiana w hub.

## 10. Iteracja na drafty (klient prosi "napisz jeszcze raz")

v0.1: klient zamyka PR bez merge → cron za 2 tyg wygeneruje nowy temat.

v0.2 zamierzony flow: klient komentuje PR `regenerate` → GitHub webhook → hub odpala nowy draft z feedbackem klienta.

## 11. Rotacja klucza

Jeśli klucz wyciekł:
1. https://console.anthropic.com/settings/keys → Find key → **Revoke**
2. Create new key
3. `pnpm exec wrangler secret put ANTHROPIC_API_KEY`
4. `wrangler deploy` (Worker pobierze nowy secret)
