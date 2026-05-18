# APPENDIX K — Admin Dashboard (pełna specyfikacja widoków)

## K.1 Struktura nawigacji

```
binary-planet-control-plane (Astro Server Islands + Hono API)
├── /                       (Overview / Today)
├── /inbox                  (Action queue — main daily work)
│   ├── /reviews            (GBP review responses pending)
│   ├── /blog-drafts        (AI blog drafts pending approval)
│   ├── /citations          (Citation submissions queue)
│   ├── /onboarding-review  (New clients pending 15-min review)
│   └── /alerts             (Negative reviews, low CWV, SSL expiring)
├── /clients
│   ├── /                   (Clients list, search, filter)
│   └── /[clientId]         (Per-client detail page)
│       ├── /overview       (Live preview + KPIs)
│       ├── /metrics        (SEO, GA4, GBP, CWV)
│       ├── /leads          (Lead stream live)
│       ├── /reviews        (GBP reviews + responses)
│       ├── /blog           (Drafts + published)
│       ├── /citations      (NAP status across 10+ directories)
│       ├── /modules        (Toggle features, billing-aware)
│       ├── /deploys        (Deploy history + logs)
│       └── /billing        (Subscription, payments, lock-in date)
├── /prospects              (CRM — pre-conversion clients)
│   ├── /                   (Pipeline kanban)
│   └── /[prospectId]       (Detail + email thread)
├── /reports                (Monthly reports archive)
├── /operations
│   ├── /scheduled-tasks    (Cron status)
│   ├── /api-quotas         (Anthropic, DataForSEO, SMSAPI usage)
│   ├── /errors             (Error log Sentry-like)
│   └── /system-health      (Hub health, region status)
└── /settings
    ├── /modules-pricing    (Edit module catalog)
    ├── /themes             (Theme presets management)
    ├── /api-keys           (External API keys)
    └── /team               (User roles: admin / VA / read-only)
```

## K.2 Overview / Today

Dashboard widget dla "co ważnego dziś":
- **MRR**: aktualna, delta vs ostatni mc, churn risk count
- **Inbox count**: X reviews pending response, Y blog drafts, Z citations queue
- **Alerts**: 🚨 negative review (Klient ABC), 🟡 CWV LCP >2.5s (Klient XYZ), 🔴 SSL expires <14d (Klient DEF)
- **Today's new leads**: top 5 latest z highlight'em hot leads (multi-page visit, returned visitor)
- **Quick actions**: "Approve all GBP responses (8 pending)", "Review new client setup", "Run citation batch"

## K.3 Inbox views — gdzie spędzasz 80% czasu

**Reviews queue:**
- Lista GBP reviews z AI-suggested response
- Card per review: ★ rating, reviewer name, review text, AI draft response (edytowalna), 3 actions: "Approve & Post", "Edit", "Skip" (response później)
- Filter: tylko ≤3 ★, tylko bez response, top mentioned topics
- Batch action: "Approve all 5★" (jeśli AI draft jest standardowy "Dziękujemy!")

**Blog drafts queue:**
- Lista draftów z preview (markdown rendered)
- Per draft: client, topic, cluster, word count, "Generated 2h ago"
- Actions: "Preview full", "Edit in GitHub PR", "Approve & merge", "Reject + reason"
- Filter: per klient, per status

**Citations queue:**
- Per klient niewykonane jeszcze citations
- Per directory: prefilled NAP data + screenshot upload field
- Klikasz "Open submission page" → otwiera new tab z katalogiem, formula prefilled (via bookmarklet lub manual paste)
- Po submisji upload screenshotu + mark as submitted
- Cel: 5–10 min batch per nowy klient, jednorazowo

## K.4 Per-client view

Widoki krytyczne:
- **Overview**: live preview iframe + KPIs (uptime 30d, last lead, CWV trend, GBP rating, monthly impressions)
- **Modules toggle**: lista wszystkich modułów (Care, Local Pro, Reputation, Conversion, Blog AI, GEO) z toggle ON/OFF + ostrzeżenie "wymaga zmiany planu" jeśli klient nie ma tieru
- **Live leads**: WebSocket connection do D1, pojawia się natychmiast po form submit
- **Live preview**: iframe z `?bp_preview=1` query → spoke renderuje z draftem zamiast deployed wersją (dla preview blog drafts)

---
