# Demo fixtures — 4 theme showcases

4 wymyślone klienty-prototypy, jeden per theme preset. Używane do:
1. **Deploy demo workerów** na `demo-{theme}.mixturemarketing.pl` (dla landing CTA "Zobacz przykład")
2. **Visual QA** themes podczas developmentu

## Demo klienci

| Theme | Klient (fikcyjny) | Branża | Wariant |
|-------|-------------------|--------|---------|
| craftsman | Ślusarz Kowalski (Rzeszów) | locksmith | red-bold |
| beauty | Salon Lila (Warszawa Mokotów) | HairSalon | rose-soft |
| food | Trattoria Bocca (Kraków Stare Miasto) | Restaurant | terracotta-warm |
| professional | Kancelaria Wiśniewski & Partnerzy (Wrocław) | ProfessionalService | navy-gold |

## Deploy demo workera (manual, ~5 min per theme)

```bash
# Prerequisite: zalogowany wrangler, CF_API_TOKEN w env

# 1. Skopiuj fixture jako active config
cp apps/starter/demo-fixtures/beauty.config.ts apps/starter/src/client.config.ts

# 2. Build
pnpm --filter mm-starter build

# 3. Create .assetsignore (Astro adapter wymaga)
cd apps/starter/dist
printf "_worker.js\n_routes.json\n" > .assetsignore
cd ../../..

# 4. Deploy z unikalną nazwą workera
cd apps/starter
pnpm exec wrangler deploy --name mm-demo-beauty
# → https://mm-demo-beauty.<account>.workers.dev

# 5. (opcjonalnie) Custom domain na demo-beauty.mixturemarketing.pl
#    via Cloudflare dashboard → Workers → mm-demo-beauty → Triggers → Add Custom Domain
```

Powtórz dla `food`, `professional`, `craftsman`.

## Auto-deploy script (TODO)

Można dorobić skrypt `scripts/deploy-demos.sh` który iteruje po fixtures i deployuje wszystkie 4 w jednym przebiegu. Na razie manual żeby nie mnożyć abstrakcji przed pierwszym deployem.

## Zalety/wady tej strategii

**Plus:** landing może wreszcie linkować do realnie wyrenderowanych stron pokazujących różnice themes.

**Minus:** te 4 strony używają **fikcyjnych danych** (NIP `1234567890`, fikcyjne nazwiska). W stopce trzeba widocznie napisać "STRONA DEMO — przykład realizacji" żeby nikt nie zadzwonił do "Salonu Lila" myśląc że to prawdziwy salon. **TODO przed deployem:** dodaj baner demo-mode do BaseLayout gdy `clientId.startsWith("clk_demo_")`.

## Roadmap

- **Faza 1 (gotowa):** per-theme Hero komponenty + 4 fixtures + deploy steps udokumentowane
- **Faza 2 (po pierwszym kliencie):** zastąp jedną z demo stron realnym klientem (case study) — i podlinkuj go z landingu zamiast prototypa
- **Faza 3 (opcjonalnie):** per-theme ServicesList / Gallery / Reviews — różnicować bardziej niż tylko Hero
