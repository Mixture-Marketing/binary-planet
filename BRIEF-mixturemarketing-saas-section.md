# Brief: dodaj sekcję SaaS "Strona w abonamencie" do mixturemarketing.pl

> **Dla agenta pracującego w repo `mixturemarketing.pl`.**
> Repo `binary-planet` to backend tego co tu sprzedajesz — patrz §2.

---

## 1. Cel

Do istniejącej agencyjnej strony **mixturemarketing.pl** (React 19 + Vite + Tailwind v4, statyczny hosting) dodać **sekcję marketingową + self-serve checkout** dla nowego subskrypcyjnego produktu:

> **"Strona w abonamencie"** — gotowa strona internetowa dla mikrofirm w PL + local SEO + Google Business Profile + leady prosto na telefon. Od **149 zł/mc**. Bez setupu, bez umowy na rok.

Cel: prospekt który ląduje na MM, klika tę sekcję, w **3 minuty** rozumie, **5 kliknięć** wybiera tier i płaci pierwszą miesięczną opłatę przez Stripe Checkout.

## 2. Backend (już istnieje w innym repo: `MixtureMarketing/binary-planet`)

To NIE jest klasyczny content marketing — pod spodem działa pełen system SaaS:

| Komponent | Co robi | URL produkcyjny |
|-----------|---------|------------------|
| **Hub API** (mm-control-plane) | Onboarding, Stripe webhooks, provisioning, RODO, faktury | `https://api.mixturemarketing.pl` |
| **Admin panel** (mm-admin) | Twój wgląd w klientów + onboarding wizard | `https://app.mixturemarketing.pl` |
| **Panel klienta** (mm-panel) | Klient widzi leady, faktury, RODO | `https://panel.mixturemarketing.pl` |
| **Starter** (mm-starter) | Template strony klienta (każdy klient dostaje własny CF Worker) | np. `https://kowalski-slusarz.pl` |

**Flow który już działa po stronie binary-planet:**
1. Klient klika tier → Stripe Checkout → płaci 149/199/299 zł
2. Stripe webhook → klient.status='provisioning'
3. Cron (lub manualny trigger): OVH rejestruje domenę → GitHub forkuje repo → CF Worker deploy → custom domain → status `active`
4. Klient dostaje email z magic linkiem do panelu + adres swojej nowej strony

**Twoja praca jest TYLKO marketing landing + integracja z 1 endpointem hub'a.**

## 3. Integracja — pojedynczy endpoint do wywołania

Self-serve Stripe Checkout = jeden POST request, dostajesz URL, redirectujesz przeglądarkę.

### Endpoint

```
POST https://api.mixturemarketing.pl/api/admin/stripe/checkout
Headers:
  Content-Type: application/json
  X-BP-Admin-Key: <ADMIN_API_KEY>   ← wymaga sekretu (patrz §10)
Body:
  {
    "client_id": "clk_<slug-from-business-name>",
    "tier": "starter" | "standard" | "premium",
    "customer_email": "klient@example.com",
    "success_path": "/dziekujemy?sid={CHECKOUT_SESSION_ID}",
    "cancel_path": "/abonament?stripe=canceled"
  }
Response (200):
  {
    "ok": true,
    "data": {
      "url": "https://checkout.stripe.com/c/pay/cs_test_xxx",
      "session_id": "cs_test_xxx"
    }
  }
```

Po dostaniu `url` — `window.location.href = url`. Stripe wyświetla swój checkout, klient płaci, wraca na `success_path`.

### Ważne UX

Problem: ten endpoint wymaga że klient **już istnieje** w D1 (status='pending'). W produkcji wymaga że wcześniej był onboarding wizard. Dla self-serve flow z marketing landing — potrzebny **lekki preonboarding** PRZED stripe checkout:

**Opcja A (zalecana, prosta):** Marketing form pyta o:
- Email
- Telefon
- Nazwę firmy
- NIP (opcjonalnie — i tak Stripe go zbierze przy checkout)
- Wybrany tier
- Akceptacja regulaminu

→ POST do **nowego endpointu** `POST /api/admin/preonboard` (do dorobienia w binary-planet — sygnalizuj mi że tego potrzebujesz, dodam ~30 min):
```json
{
  "business_name": "...",
  "email": "...",
  "phone": "...",
  "nip": "...",
  "tier": "starter",
  "consent_marketing": true
}
```
→ Hub tworzy `clients` row ze statusem `pending`, zwraca `{ client_id: "clk_..." }`.
→ Następnie POST do `/api/admin/stripe/checkout` z tym `client_id` + `tier`.
→ Klient redirectuje na Stripe.
→ Po checkout: Stripe webhook → status `provisioning` → cron Track 4 → strona klienta live w 24h.

**Opcja B (jeszcze prostsza, brak naszego API):** Lead-only flow. Marketing form → email z linkiem do "Dokończ onboarding" → klient klika → ląduje na `app.mixturemarketing.pl/onboarding/new` (mm-admin) → wypełnia 10-sekcyjny wizard → submit triggeruje Stripe Checkout. Bez stripe-na-landing.

> **Rekomendacja:** Opcja A. Czemu: konwersja landing → płacący klient spada drastycznie z każdym dodatkowym klikiem/screenem. Jeśli prospekt już zdecydowany, musi móc zapłacić w <5 kliknięć.

**Czekam na sygnał czy potrzebujesz `/api/admin/preonboard` endpointa** — jeśli tak, daję znać w binary-planet bocznym czasie ~30 min.

## 4. Sekcja w mixturemarketing.pl — gdzie

Z istniejącej nawigacji ("O Nas", "Realizacje", "Oferta" dropdown):

- **W dropdownie "Oferta" dodaj nowy item:** "Strona w abonamencie" (lub "Pakiet SaaS dla mikrofirm")
- **URL:** `/strona-w-abonamencie` lub `/abonament`
- **W footerze:** link "Strona w abonamencie" obok pozostałych usług
- **Na home page:** czwarta karta usługi (obok Web Dev / Digital Marketing / Grafika):
  ```
  Strona w abonamencie
  "Cały pakiet — strona, SEO, leady — od 149 zł/mc"
  → przycisk "Zobacz pakiety"
  ```

## 5. Sekcje samej strony `/abonament`

### Hero (above the fold)
```
H1: Strona internetowa w abonamencie
H2: Cały pakiet w jednej cenie. Od 149 zł/mc.
    Strona + SEO + Google Business + leady na telefon.
    Bez setupu, bez umowy na rok.

[Wybierz pakiet — od 149 zł]   [Zobacz demo]
                                ↓ scroll to embedded iframe
```

**Tło**: subtelny gradient lub abstrakcyjna ilustracja sieci/połączeń. Bez ślusarzy/mikrofirm na grafice — chcemy uniwersalne wrażenie.

### Problem-solution (3 punkty)
```
"Mała firma. Brak czasu na marketing."

Klient szuka Cię w Google. Nie znajduje.
→ My ustawiamy Twoją stronę + GBP w 24h.

Klient wypełnia formularz. Ty nic nie wiesz.
→ SMS w 30 sekund. Telefon przed konkurencją.

Co miesiąc tracisz pieniądze na "agencje"
która nic nie dowozi.
→ Stała cena. Realne raporty. Możesz zrezygnować w każdej chwili.
```

### Demo (embedded iframe)
```
Zobacz prawdziwą stronę pilotowego klienta —
ślusarza z Rzeszowa.

<iframe src="https://kowalski-slusarz.pl/" width="100%" height="700"
  loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups"
  style="border: 1px solid var(--border); border-radius: 12px;" />

Live link: kowalski-slusarz.pl ↗
```

> **A11y note:** dodaj `title="Demo strony klienta — Ślusarz Kowalski Rzeszów"` do iframe.
> **Performance:** `loading="lazy"` żeby nie blokować Lighthouse score.

### Pricing (3 karty)
3 tier'y, side-by-side na desktop, stacked na mobile. **Standard zaznaczony jako "Najpopularniejszy"** (akcent kolorystyczny + lekko podniesiona karta).

```
┌─────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐
│  STARTER            │  │  STANDARD  ⭐           │  │  PREMIUM            │
│  149 zł / mc        │  │  199 zł / mc            │  │  299 zł / mc        │
│                     │  │  najpopularniejszy      │  │                     │
│  Dla mikrofirm      │  │  Dla rozwijających się  │  │  Dla wielolokal.    │
│                     │  │                         │  │                     │
│  ✓ Strona (Astro)   │  │  Wszystko z Starter +   │  │  Wszystko ze Stand. │
│  ✓ Hosting CF       │  │  ✓ Blog AI 2x/mc        │  │  ✓ Multi-location   │
│  ✓ Domena .pl       │  │  ✓ Raporty miesięczne   │  │  ✓ Programmatic SEO │
│  ✓ Local SEO        │  │  ✓ Synchronizacja GBP   │  │  ✓ Priorytet support│
│  ✓ Google Business  │  │  ✓ Reviews flow (SMS)   │  │  ✓ Custom branding  │
│  ✓ Email + SMS lead │  │                         │  │                     │
│  ✓ Panel klienta    │  │                         │  │                     │
│  ✓ RODO + DPA       │  │                         │  │                     │
│                     │  │                         │  │                     │
│  [Wybierz Starter]  │  │  [Wybierz Standard]     │  │  [Wybierz Premium]  │
└─────────────────────┘  └────────────────────────┘  └─────────────────────┘
```

**Kliknięcie buttona** → otwiera modal "Krótki formularz przed płatnością" (patrz §6).

### Co dostajesz w pakiecie (rozwinięcie)
Akordeon lub grid z ikonkami Lucide React:
- **Strona** (lucide: `Globe`) — Astro 5, hosting CF Workers, ładuje w <1s
- **Domena** (lucide: `Link`) — rejestracja `twojafirma.pl` w cenie pakietu
- **Local SEO** (lucide: `MapPin`) — strony pod każde miasto z Twojego obszaru obsługi (6 stron programmatic)
- **GBP synchronizacja** (lucide: `Building2`) — Google Business Profile zsynchronizowany z Twoją stroną
- **Leady** (lucide: `Inbox`) — formularz + telefon-click → SMS do Ciebie w 30s + email
- **Panel klienta** (lucide: `LayoutDashboard`) — widzisz leady, faktury, raporty
- **Blog AI** (lucide: `FileText`) — Standard+: nowy wpis na bloga co 2 tygodnie (klient zatwierdza)
- **RODO + DPA** (lucide: `Shield`) — wszystko zgodnie z prawem, DPA do podpisu
- **Faktury VAT** (lucide: `Receipt`) — automatycznie 1. dnia mc przez Fakturownia.pl
- **Stała cena** (lucide: `Check`) — bez ukrytych kosztów, bez umowy na rok, możesz zrezygnować w każdej chwili

### Jak to działa (4 kroki + ilustracja)
```
1. Wybierasz pakiet → płacisz pierwszą opłatę kartą
2. Wypełniasz wizard onboardingu (5 minut, mamy gotowe pytania)
3. W 24h Twoja strona jest live pod twojafirma.pl
4. Leady zaczynają przychodzić — SMS w 30s, telefon przed konkurencją
```

### FAQ
- "Czy mogę zrezygnować?" — Tak, w każdej chwili. Cancel w panelu, kolejny mc nie pobierany.
- "Co jeśli mam już stronę?" — Możemy zmigrować content + przekierować domenę. Doliczamy 199 zł setup.
- "Kto jest właścicielem domeny?" — Ty. Domena rejestrowana na NIP Twojej firmy w OVH.
- "Kto pisze treści?" — Standard+ ma AI content (Claude Sonnet), klient zatwierdza. Starter: ty piszesz przez panel.
- "Co z RODO?" — DPA do podpisu, polityka prywatności na stronie, retencja leadów 24mc.
- "Ile czasu trwa setup?" — 24h od pierwszej płatności.
- "Czy obsługujecie branżę X?" — 16 wbudowanych branż: ślusarz/mechanik/stolarz/hydraulik/elektryk/dekarz/beauty/fryzjer/dentysta/fizjo/księgowa/prawnik/restauracja/kawiarnia/kwiaciarnia. Inne — zapytaj.

### Cold-CTA bottom
"Nie jesteś pewien?" → form "Porozmawiaj z nami" → email do MM.

## 6. Modal: "Krótki formularz przed płatnością"

Open po kliknięciu **[Wybierz tier X]**. To jest preonboarding z §3 opcja A.

```
Cztery pola (wszystkie required):
  1. Nazwa firmy           [text]
  2. Email                 [email]
  3. Telefon               [tel] +48...
  4. NIP                   [text] 10 cyfr (z auto-walidacją PL — sprawdza poprzez wybiera regex)

Plus:
  ☐ Akceptuję regulamin i politykę prywatności (link)
  ☐ Zgoda na marketing (opcjonalnie)

[Zapłać 199 zł kartą →]
```

**Po submit (JS):**
```javascript
// 1. Create klient w hubie
const preonboard = await fetch('https://api.mixturemarketing.pl/api/admin/preonboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-BP-Admin-Key': PUBLIC_PREONBOARD_KEY },
  body: JSON.stringify({ business_name, email, phone, nip, tier, consent_marketing })
})
const { data: { client_id } } = await preonboard.json()

// 2. Get Stripe Checkout URL
const checkout = await fetch('https://api.mixturemarketing.pl/api/admin/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-BP-Admin-Key': PUBLIC_PREONBOARD_KEY },
  body: JSON.stringify({
    client_id,
    tier,
    customer_email: email,
    success_path: `/abonament/dziekujemy?sid={CHECKOUT_SESSION_ID}`,
    cancel_path: '/abonament?stripe=canceled'
  })
})
const { data: { url } } = await checkout.json()

// 3. Redirect to Stripe
window.location.href = url
```

> **PUBLIC_PREONBOARD_KEY** — wstrzyknij przy build via env var. To **publiczny** klucz (różny od `ADMIN_API_KEY` używanego w cron) — limit per-IP rate limit żeby nie spamowali tworząc nieskończenie wielu klientów. Daj znać czy potrzebujesz że to wystawimy — TODO w binary-planet.

## 7. Strona `/abonament/dziekujemy` (post-Stripe success)

```
Hero z dużym ✓ (lucide: CheckCircle2, color: green)
H1: Płatność zaakceptowana!
H2: Twoja strona będzie gotowa w 24h.

Co dalej:
1. Sprawdź skrzynkę email — wysłaliśmy magic link do Twojego panelu klienta.
2. W panelu wypełnij wizard onboardingu (godziny, usługi, opinie).
3. W 24h dostaniesz email "Twoja strona jest live pod twojafirma.pl".

[Otwórz panel klienta →]   [Zaplanuj rozmowę z konsultantem]
```

URL guzika "Otwórz panel klienta" → `https://panel.mixturemarketing.pl/login`

## 8. Strona `/abonament` gdy `?stripe=canceled`

Komunikat (jak po cancel checkout):
```
"Anulowałeś płatność. Możesz spróbować ponownie — Twój wybór nie został utracony."
[Wróć do pakietów ↑]
```

## 9. SEO + meta

```html
<title>Strona internetowa w abonamencie od 149 zł/mc — MixtureMarketing</title>
<meta name="description" content="Gotowa strona internetowa dla mikrofirm w PL. Local SEO + Google Business + leady na telefon. Bez setupu, bez umowy na rok. Wybierz pakiet i zacznij dziś." />
<meta property="og:title" content="Strona w abonamencie — 149 zł/mc" />
<meta property="og:description" content="..." />
<meta property="og:image" content="/og-strona-w-abonamencie.png" />
```

JSON-LD: `Service` typ Product z `offers` per tier:
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Strona internetowa w abonamencie",
  "provider": { "@type": "Organization", "name": "MixtureMarketing", "url": "https://mixturemarketing.pl" },
  "offers": [
    { "@type": "Offer", "name": "Starter", "price": "149", "priceCurrency": "PLN", "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" } },
    { "@type": "Offer", "name": "Standard", "price": "199", "priceCurrency": "PLN", "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" } },
    { "@type": "Offer", "name": "Premium", "price": "299", "priceCurrency": "PLN", "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" } }
  ]
}
```

Dodaj `/abonament` do sitemap.xml.

## 10. Sekrety wymagane

Agent musi mieć dostęp do **PUBLIC_PREONBOARD_KEY** — wstrzyknięty przy build:

- W Vite: `import.meta.env.VITE_MM_PREONBOARD_KEY`
- W Vercel/Netlify/CF Pages: zmienna środowiskowa
- W lokalnym `.env`: `VITE_MM_PREONBOARD_KEY=xxx`

Sygnalizuj że potrzebujesz — wystawię w binary-planet (rate-limit per IP, scope: tylko POST /api/admin/preonboard + POST /api/admin/stripe/checkout).

## 11. Stack-specific (React 19 + Tailwind v4 + Vite)

- **Komponenty:** stwórz `src/pages/Abonament/` lub `src/sections/Abonament/` (zgodnie z konwencją repo)
- **Stan modal:** używaj `useState` lokalnie + `useTransition` dla submit
- **Form validation:** Zod + react-hook-form (jeśli już są w repo) lub natywne `<input required pattern="..." />`
- **Tailwind v4:** używaj utility classes + `@theme` w `globals.css` jeśli potrzebujesz custom colors
- **Iconki:** Lucide React (już używasz)
- **Critical CSS (Critters):** sekcja Hero powinna być inline-CSS, reszta lazy
- **SSG (Puppeteer):** `/abonament` i `/abonament/dziekujemy` mogą być pre-rendered, dynamiczna część (modal + form) hydruje client-side

## 12. Wzór wyglądu — wpasuj się

Z analizy istniejącej mixturemarketing.pl:
- **Color palette:** monochromatyczny + akcenty (niebieskie? zielone? sprawdź `tailwind.config.ts` / `theme.css`)
- **Typography:** clean, generous whitespace
- **Layout:** card-based, code snippets w niektórych sekcjach
- **Tone:** technologiczny ale przystępny

**Dla sekcji `/abonament`:**
- Hero powinien wyglądać **inaczej** od reszty strony — to nowy produkt, "świeży" feel
- Sugeruję akcent kolorystyczny inny niż reszta serwisu (np. **zielony**, ten sam co panel klienta — coherent brand między marketingiem a użytkownikiem) — sprawdź `mm-panel` styles dla referencji: `https://github.com/MixtureMarketing/binary-planet/blob/main/apps/panel/src/styles/panel.css` (`--c-brand: #047857`)

## 13. Test (po deploy)

1. Otwórz `/abonament` w incognito
2. Klik "Wybierz Standard"
3. Wypełnij modal
4. Klik "Zapłać 199 zł"
5. Powinieneś trafić na Stripe Checkout (test mode!)
6. Użyj **test card** `4242 4242 4242 4242` z dowolnym CVV/datą
7. Po success — `/abonament/dziekujemy`
8. Sprawdź w binary-planet hub:
   ```
   GET https://api.mixturemarketing.pl/api/health
   ```
   I w mm-admin (`app.mixturemarketing.pl/clients`) — nowy klient z statusem `provisioning`.

## 14. Co potrzebuje TY w binary-planet (lista do zrobienia po mojej stronie)

Daj sygnał agentowi w mixturemarketing, że potrzebujesz tego — wtedy ja dorobię w binary-planet:

- [ ] **POST `/api/admin/preonboard`** — endpoint tworzący `clients` row + rate limit per IP (~30 min pracy)
- [ ] **PUBLIC_PREONBOARD_KEY** secret (różny od ADMIN_API_KEY, scope-limited) + dokumentacja w STRIPE-SETUP.md
- [ ] **Rate limit** dla preonboard endpoint w KV (np. 5 prób/IP/h, zapobiec spamowi)
- [ ] **Cancel webhook** — jeśli klient anuluje subskrypcję w Stripe, klient.status='churned' → strona klienta przestaje być pod custom domain (already wired, just confirm)
- [ ] **Endpoint `/api/admin/preonboard`** powinien też przyjmować `referral_code` (Faza 5 L.4) — ale na razie ignoruj jeśli nie ma w pierwszej iteracji

## 15. Co zostaje TY (właściciel MM) do zrobienia manualnie

- [ ] Skrót w nawigacji "Oferta" dropdown
- [ ] OG image `/og-strona-w-abonamencie.png` (1200x630, design)
- [ ] Polityka prywatności + Regulamin SaaS — update przez prawnika (już planowane Faza 0)
- [ ] DPA template do pobrania z `/dpa.pdf` link
- [ ] Tekst "O nas dla branży SaaS" jeśli prospekt klika "O Nas" — można zostawić obecny tekst agencyjny

## 16. Co dalej (po launch)

V0.2 może dodać:
- Wbudowany kalkulator ROI ("ile leadów dostaniesz")
- Strony lokalne `/abonament/{miasto}` (programmatic) — "Strona w abonamencie dla firm z Rzeszowa"
- Strony per-branża `/abonament/dla-slusarzy` — branżowe copy + testimonials
- Webinary "Jak działa lead w 30 sekund" — demand gen

---

## Krótka instrukcja pierwszego kroku

1. Stwórz branch `feat/saas-abonament-section`
2. Dodaj pliki:
   - `src/pages/Abonament/index.tsx` (lub /Abonament.tsx)
   - `src/pages/Abonament/dziekujemy.tsx`
   - `src/pages/Abonament/components/PricingCards.tsx`
   - `src/pages/Abonament/components/PreonboardModal.tsx`
   - `src/pages/Abonament/components/DemoIframe.tsx`
3. Dodaj route w router (React Router?)
4. Sygnalizuj że potrzebujesz `PUBLIC_PREONBOARD_KEY` + endpoint `/api/admin/preonboard` po stronie binary-planet
5. Stwórz placeholder form (POST do `https://api.mixturemarketing.pl/api/admin/preonboard` z TODO note)
6. Dodaj link w nawigacji "Oferta" dropdown
7. Push branch → zwrotnie ja dostarczę endpoint po stronie hub'a → finalizujesz integrację

**Estymata pracy:** 1-2 dni dla agenta (sekcja + form + integracja + responsive + Lighthouse + SEO meta).

---

## Cześci NIE dotyczące marketingu — pomijaj

- ❌ Nie buduj panelu klienta (już istnieje na `panel.mixturemarketing.pl`)
- ❌ Nie buduj admin paneli (już istnieje na `app.mixturemarketing.pl`)
- ❌ Nie buduj samego onboarding wizardu (już istnieje w mm-admin)
- ❌ Nie zarządzaj subskrypcjami klientów (hub robi)
- ❌ Nie generuj treści blogowych (binary-planet ma AI blog cron)
- ✅ TYLKO marketing landing + Stripe Checkout entry point

---

**Kontakt:** Jeśli pytania — daj znać Jakubowi (właściciel obu repo), on przekaże dalej w binary-planet sesji.
