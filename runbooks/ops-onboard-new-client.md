# OPS: Manual onboarding (fallback gdy auto-provisioning broken)

**Typ:** Fallback procedure
**Czas trwania:** ~45 min manual vs <30 min auto
**Last updated:** 2026-05-18

Auto-provisioning workflow (Faza 3) handluje 99% przypadków. Ten runbook = backup gdy workflow stuck.

Patrz [00-main "Faza 3"](../plan/00-main.md) dla auto flow + [J-hub-spoke](../plan/J-hub-spoke.md) dla architektury.

## Kiedy używać

- Webhook Stripe failed, ale klient zapłacił (potwierdzona płatność w dashboard)
- Cloudflare Workflow utknął na konkretnym kroku
- Klient ma special requirements które nie pasują do wizardu (rzadkie, ale możliwe)
- Demo client dla pilot (nie chcemy pełnego billing flow)

## Dane wejściowe (zbierz przed startem)

Klient z wizardu lub email:

- Nazwa firmy (z REGON jeśli NIP wprowadzony)
- NIP, REGON, adres
- Domena docelowa (klient ma własną LUB chce żebyśmy zarejestrowali w OVH)
- GBP Place ID (jeśli ma)
- Branża → theme preset (craftsman / professional / medical / beauty / local-services)
- Wariant kolorystyczny (1-5 per preset)
- Lista usług (max 8)
- Service area (miasta, dzielnice)
- Godziny otwarcia
- Logo + zdjęcia (lub plan użyć stocków z presetu)
- Tier (Starter 149 / Standard 199 / Premium 299) + model płatności

## Procedure

### Krok 1 — Create client w D1 control plane

```bash
# TODO: po Faza 3 — skrypt:
# mm-control-plane/scripts/create-client.ts

# Manual SQL:
CLIENT_ID="clk_$(openssl rand -hex 8)"
wrangler d1 execute mm-control-plane --command "
  INSERT INTO clients (id, name, nip, regon, email, phone, tier, status, theme_preset, theme_variant, created_at)
  VALUES ('$CLIENT_ID', '<nazwa>', '<NIP>', '<REGON>', '<email>', '<phone>', '<starter|standard|premium>', 'provisioning', '<preset>', '<variant>', datetime('now'))
"
```

### Krok 2 — Generuj API key (BP_CLIENT_API_KEY)

```bash
BP_KEY="ck_live_$(openssl rand -hex 32)"
BP_HASH=$(echo -n "$BP_KEY" | sha256sum | cut -d' ' -f1)
wrangler d1 execute mm-control-plane --command \
  "UPDATE clients SET api_key_hash = '$BP_HASH' WHERE id = '$CLIENT_ID'"

# Zapisz BP_KEY tymczasowo — będzie potrzebny w kroku 6
echo "TEMP API KEY (delete after deploy): $BP_KEY"
```

### Krok 3 — Stwórz repo klienta z template

```bash
# Wymaga: GitHub CLI authenticated jako mm-internal user lub GitHub App

REPO_NAME="mm-client-$CLIENT_ID"
gh repo create mixturemarketing/$REPO_NAME \
  --template mixturemarketing/mm-starter \
  --private \
  --description "Klient $CLIENT_ID — <nazwa firmy>"

# Clone lokalnie
cd /tmp
gh repo clone mixturemarketing/$REPO_NAME
cd $REPO_NAME
```

### Krok 4 — Wypełnij client.config.ts

```bash
# Edit src/client.config.ts ręcznie (lub przez template script jeśli istnieje):

cat > src/client.config.ts <<'EOF'
import type { ClientConfig } from "@mixturemarketing/web-core";

export const config: ClientConfig = {
  clientId: "<CLIENT_ID>",
  business: {
    name: "<nazwa>",
    nip: "<NIP>",
    regon: "<REGON>",
    email: "<email>",
    phone: "<phone>",
    address: { street: "...", city: "...", postalCode: "...", country: "PL" },
    gbpPlaceId: "<place_id_or_null>",
  },
  theme: {
    preset: "<preset>",
    variant: "<variant>",
  },
  services: [
    { slug: "...", name: "...", price: "...", description: "..." },
    // ... max 8
  ],
  serviceArea: ["Rzeszów", "Boguchwała", "..."],
  hours: {
    monday: "08:00-18:00",
    // ...
    sunday: "closed",
  },
  integrations: {
    plausible: true,
    ga4: null,         // opcjonalnie
    metaPixel: null,
  },
};
EOF

git add . && git commit -m "Initial config for <nazwa>" && git push
```

### Krok 5 — AI generuje content (lub manual jeśli AI broken)

```bash
# TODO: po Faza 3 — skrypt:
# pnpm content:generate --client <CLIENT_ID>

# Manual fallback:
# 1. Open Anthropic console / Claude desktop
# 2. Użyj promptów z [D-ai-content-prompts.md](../plan/D-ai-content-prompts.md) per branża
# 3. Wklej wyniki w src/content/* (home hero, about, services, FAQ)
# 4. Commit
git add src/content/ && git commit -m "Initial AI content" && git push
```

### Krok 6 — Deploy Worker

```bash
# Wymaga: CF_API_TOKEN env var ustawione

# Set secret
echo "$BP_KEY" | wrangler secret put BP_CLIENT_API_KEY --env production --name mm-client-$CLIENT_ID

# Deploy
wrangler deploy --env production --name mm-client-$CLIENT_ID

# Verify Worker URL
curl https://mm-client-$CLIENT_ID.workers.dev/
```

### Krok 7 — CF for SaaS Custom Hostname

```bash
# Klient ma własną domenę:
DOMAIN="<klient-domena.pl>"

curl -X POST "https://api.cloudflare.com/client/v4/zones/<MM_ZONE_ID>/custom_hostnames" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"hostname\": \"$DOMAIN\",
    \"ssl\": { \"method\": \"http\", \"type\": \"dv\" }
  }"
# Note: hostname_id z response

# Email do klienta z instrukcją DNS (jeśli klient nie pod naszym OVH):
# "Proszę dodać CNAME: $DOMAIN → bp-clients.cfargotunnel.com"
```

### Krok 8 — DNS (jeśli domena pod naszym OVH)

```bash
# Auto-rejestracja domeny:
# TODO: po Faza 3 — OVH API integration
# ovh-cli domain order $DOMAIN --duration 1 --pay-with credit
# ovh-cli domain zone $DOMAIN record add --type CNAME --subDomain @ --target bp-clients.cfargotunnel.com
```

### Krok 9 — Sveltia CMS access

```bash
# Sveltia używa GH OAuth — klient potrzebuje GitHub account LUB MM Editor GH App.

# Opcja A — klient ma GH:
# Dodaj klienta jako Collaborator (Read+Write) do repo:
gh api repos/mixturemarketing/mm-client-$CLIENT_ID/collaborators/<gh-username> \
  -X PUT -f permission=push

# Opcja B — MM Editor GH App (TODO: po Faza 3):
# Klient loguje się przez /admin → OAuth do naszego GH App → commits jako bot
```

### Krok 10 — Activate w D1

```bash
wrangler d1 execute mm-control-plane --command \
  "UPDATE clients 
   SET status = 'active', live_at = datetime('now'), primary_domain = '$DOMAIN', worker_name = 'mm-client-$CLIENT_ID'
   WHERE id = '$CLIENT_ID'"
```

### Krok 11 — Email do klienta

```
Temat: Twoja strona [domena] jest gotowa!

Dzień dobry,

Strona [domena] jest live! 🎉

Co Pan/Pani dostaje:
1. Live strona: https://[domena]
2. Panel administracyjny (edycja treści): https://[domena]/admin
   - Login przez konto GitHub LUB jednorazowy link który zaraz wyślę
3. Panel klienta (statystyki, leady, faktury): https://app.mixturemarketing.pl/login
   - Magic link wysłany na Pana email

Pierwsze kroki:
1. Sprawdź czy wszystko OK — proszę przejrzeć strony i powiedzieć jeśli coś trzeba zmienić
2. Wgraj zdjęcia (logo, fotka z zakładu, realizacje) — przez panel admin
3. Sprawdź godziny otwarcia + dane kontaktowe

Co dzieje się dalej:
- Już dziś rejestruję Pana stronę w Google Search Console + Business Profile
- W ciągu 30 dni dodajemy stronę do 30+ katalogów branżowych (citation building)
- Pierwszy raport miesięczny dostanie Pan 1. dnia następnego miesiąca

W razie pytań — proszę pisać na info@mixturemarketing.pl lub dzwonić: [tel].

Pozdrawiam,
Jakub
MixtureMarketing
```

### Krok 12 — Trigger post-onboarding workflows

```bash
# TODO: po Faza 5
# - Citation builder kick off (30 katalogów)
# - GBP integration setup workflow
# - Drip email sequence start
# - Add do "15-min review queue" (admin dashboard inbox)

# Manualnie dla pilot klientów:
# - Add wpis w GSC manualnie
# - Verify w GBP manualnie
# - Dodaj na własną listę "klienci do monitorowania pierwsze 30 dni" (anti-churn)
```

## Time tracking

Loguj czas: powinno być <45 min manual. Jeśli więcej — bug w procedurze, update runbook.

## Common pitfalls

- **Forgot to set BP_CLIENT_API_KEY** — spoke nie umie połączyć z hub, leady fail
- **Custom hostname DCV stuck** — sprawdź czy klient dodał DNS records (Scenario B w P2-ssl)
- **AI content quality** — jeśli AI generuje placeholder text ("Lorem ipsum"), nie commituj. Re-generate.
- **Repo permissions** — klient musi mieć dostęp do Sveltia (Krok 9), inaczej zaraz dzwoni

## Update log

- **2026-05-18** — pierwsza wersja (placeholder dla auto-provisioning z Fazy 3)
