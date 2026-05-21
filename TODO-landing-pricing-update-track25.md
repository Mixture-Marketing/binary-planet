# Track 25 — Update cennika na `mixturemarketing.pl/abonament/`

> **Dla agenta pracującego nad repo `D:\KOD\Mixture\MixtureMarketing-stona`**
> Update: **2026-05-19**. Hub side (binary-planet) gotowy, czeka na landing update.

---

## TL;DR

Zmiana cen pakietów + dodanie 4-tego tieru "Professional" dla branż regulowanych (prawnik / lekarz / księgowy / fizjoterapeuta).

| Tier | Stara cena | **Nowa cena** | Status binary-planet |
|------|-----------|---------------|----------------------|
| Starter | 149 zł/mc | **179 zł/mc** | ✅ Stripe Price `price_1TYtNTEL6Ig5ZsLVBvyJZCVx` |
| Standard | 199 zł/mc | **249 zł/mc** | ✅ Stripe Price `price_1TYtNVEL6Ig5ZsLVz8bAorNl` |
| Premium | 299 zł/mc | **349 zł/mc** | ✅ Stripe Price `price_1TYtNWEL6Ig5ZsLVLv1zz477` |
| 🆕 **Professional** | — | **549 zł/mc** | ✅ Stripe Price `price_1TYtNXEL6Ig5ZsLVh50iq9mG` |

Setup opłata: była **199 zł** → jest **0 zł** (wliczone w pakiet).
Promo: "Pierwsze 10 klientów: **-50 zł/mc przez 3 miesiące**" (zamiast obecnego setup=0 dla pierwszych 10).

---

## ✅ Co jest po stronie binary-planet (już zrobione)

- ✅ Migration `0012_tier_professional.sql` zastosowana — `clients.tier` CHECK akceptuje `'professional'`
- ✅ Stripe Products + Prices stworzone (4 nowe, IDs powyżej)
- ✅ Hub secrets: `STRIPE_PRICE_STARTER`/`STANDARD`/`PREMIUM`/`PROFESSIONAL` zaktualizowane
- ✅ `POST /api/admin/preonboard` przyjmuje `tier=professional`
- ✅ `POST /api/admin/stripe/checkout` przyjmuje `tier=professional`
- ✅ Webhook `tierFromPriceId()` rozpoznaje nowy tier
- ✅ Email "uzupełnij wizard" pokazuje nowe ceny w label (Starter 179 / Standard 249 / Premium 349 / Professional 549)
- ✅ mm-admin onboarding wizard ma 4 opcje
- ✅ panel klienta `addons.astro` ma poprawne tier base prices

---

## 🎯 Do zrobienia na landing `mixturemarketing.pl/abonament/`

### 1. Pricing table — update cen + features w 3 kolumnach + dodanie 4-tej (CTA)

**Repo:** `D:\KOD\Mixture\MixtureMarketing-stona`

**Co zmienić w cennikach:**

#### Starter — 179 zł/mc (było 149 zł/mc)
**Co dodano w cenie (zaznacz w features list jako "nowe"):**
- ✨ Pozycjonowanie Wizytówki Google (GBP basic setup) — było jako dodatek 50 zł/mc
- ✨ Widget rezerwacji Booksy/Calendly embedded — było jako one-time 99-199 zł
- ✨ Live widget opinii Google na stronie
- Click-to-call sticky button na mobile

**Zostaje:**
- Strona 5 podstron
- CMS Sveltia (klient sam edytuje)
- LocalBusiness schema + Google Maps embed + NAP
- llms.txt (basic — pod AI search)
- Plausible analityka cookieless
- Formularz lead + Turnstile anti-bot
- Backup 1×/dobę → R2
- SSL + CF DDoS

#### Standard — 249 zł/mc (było 199 zł/mc)
**Co dodano w cenie:**
- ✨ Galeria z filtrami (przed/po dla beauty/mechanik, kategorie dla restauracji)
- ✨ Lokalne SEO dzielnicowe (auto-podstrony "Ślusarz Mokotów", "Ślusarz Ursynów" itp.) — *była nazwa "programmatic SEO", przemianowana na ludzki język*
- ✨ SMS reminder przed wizytą (1 typ, basic)

**Zostaje:**
- Wszystko ze Startera
- Do 12 podstron
- FAQ + 2 formularze lead
- Custom theme variant
- Schema.org rozszerzone (Service, Offer, AggregateRating)
- Audyt SEO 1×/kwartał

#### Premium — 349 zł/mc (było 299 zł/mc)
**Co dodano w cenie (najatrakcyjniejsze — było 130 zł/mc w dodatkach!):**
- ✨ Zarządzanie opiniami Google PRO (AI draft odpowiedzi, klient akceptuje) — było 40 zł/mc dodatek
- ✨ Wizytówka Google monthly posting (3 posty/mc, AI assist) — było 50 zł/mc dodatek
- ✨ Call tracking (zliczanie połączeń ze strony + Google Mapy) — było 30 zł/mc dodatek

**Zostaje:**
- Wszystko ze Standard
- Unlimited podstron
- Blog AI (2 posty/mc auto-generowane via Claude Haiku, klient akceptuje)
- A/B testing CTA
- Priorytetowy support 24h
- Audyt SEO comiesięczny

#### 🆕 Professional — 549 zł/mc (nowy tier)
Sekcja jako 4-ty box LUB CTA banner pod tabelą — UI agent decyduje.

**Sugerowany copy:**
> 🏛️ **Pakiet Professional — dla branż profesjonalnych**
>
> Dla **adwokatów, lekarzy, księgowych, fizjoterapeutów, doradców** wymagamy podwyższonych standardów: prywatność klienta, RODO, sekcja publikacji, case studies.
>
> **W cenie Premium plus:**
> - Sekcja "Publikacje i wystąpienia" jako kolekcja CMS
> - Case studies anonimizowane (zgodne z tajemnicą zawodową)
> - Bezpieczny upload dokumentów (end-to-end, R2, 30-day retention)
> - Pakiet RODO+ (DPA jako ADO, rejestr czynności, klauzule informacyjne, szyfrowanie załączników)
> - Integracja Cal.com + płatna konsultacja przez Stripe (np. konsultacja 30 min)
> - Wersja językowa EN/UA w cenie (zwykle 199 zł one-time)
> - Trust badges (numer wpisu na listę, polisa OC)
> - AI Blog **wyłączony** domyślnie (klient sam pisze — ryzyko reputacyjne)
> - FOMO/Leadpop **wyłączone** (nieprofesjonalne dla branży)
>
> **549 zł/mc** — przy stawkach 300-500 zł/h jeden lead zwraca rok abonamentu.
>
> [Zapytaj o pakiet Professional →]

### 2. Modal preonboard — dropdown z 4 opcjami

```html
<!-- Stary modal: radio buttons z 3 tiers -->
<select name="tier" required>
  <option value="">— wybierz pakiet —</option>
  <option value="starter">Starter — 179 zł/mc</option>
  <option value="standard" selected>Standard — 249 zł/mc</option>
  <option value="premium">Premium — 349 zł/mc</option>
  <option value="professional">Professional — 549 zł/mc (B2B regulowane)</option>
</select>
```

**Modal POST body bez zmian** — kontrakt to `tier: "starter"|"standard"|"premium"|"professional"`. Hub przyjmuje wszystkie 4 wartości.

### 3. JSON-LD `Offer` schema — dodać 4-ty offer

W `<script type="application/ld+json">`:
```json
{
  "@type": "Service",
  "@id": "https://mixturemarketing.pl/abonament#offer-professional",
  "name": "Pakiet Professional",
  "description": "Pakiet Professional — dla branż regulowanych (prawnik, lekarz, księgowy). 549 zł netto / miesiąc.",
  "offers": {
    "@type": "Offer",
    "price": "549",
    "priceCurrency": "PLN",
    "billingDuration": "P1M"
  }
}
```

Plus update istniejących 3 offers: `"price"` z 149/199/299 → **179/249/349**.

### 4. Setup pricing — wycofać

Usuń wszystkie "199 zł setup" / "setup 199 zł" / "opłata aktywacyjna". Setup jest teraz **0 zł** (wliczone). Replace na "**Bez opłat aktywacyjnych**".

### 5. Promo banner — change

Stara wersja: "Pierwsze 10 klientów setup gratis (oszczędzasz 199 zł)"
Nowa: "**Pierwsze 10 klientów: -50 zł/mc przez 3 miesiące** (oszczędzasz do 150 zł)"

(Tańsze dla nas niż setup 199 i bardziej widoczne value przez 3 mc).

### 6. FAQ — dodać/zmienić pytania

**Dodać:**
- "Czym różni się Professional od Premium?" → odpowiedź jak w copy wyżej
- "Dla kogo Professional?" → adwokat / lekarz / księgowy / fizjoterapeuta / dietetyk
- "Czy mogę przejść między pakietami?" → tak, w panelu klienta, zmiana od następnego okresu rozliczeniowego

**Zmienić:**
- "Ile kosztuje strona u was?" — update cen 149/199/299 → 179/249/349/549
- "Co zawiera setup?" → usunąć, setup już nie istnieje jako osobna opłata

### 7. .env.local — zachować

`VITE_MM_PREONBOARD_KEY` zostaje bez zmian (klucz preonboard sam się nie zmienił).

---

## 🧪 Test po deploy

1. Otwórz `https://mixturemarketing.pl/abonament/` w incognito
2. Sprawdź czy ceny 179/249/349 + Professional 549 widoczne
3. Otwórz modal preonboard → wybierz "Professional" → wypełnij dane → submit
4. Sprawdź czy preonboard endpoint zwrócił `{ok:true, data:{client_id:"clk_..."}}`
5. Sprawdź czy Stripe Checkout otwiera się z prawidłową ceną 549 zł
6. NIE płacić (test mode)
7. W mm-admin sprawdź czy klient ma `tier='professional'` w D1

---

## 📞 Kontakt na zwrot info

Po update — daj znać Jakubowi (info@mixturemarketing.pl) że landing jest zaktualizowany. Hub side już gotowy więc cały flow zadziała od razu.

---

**Wersja:** Track 25 v1.0
**Hub deployed:** `dafa4f0d-51a7-48ec-a049-6eb4a81241a9` (2026-05-19)
**Stripe Price IDs (test mode):**
- Starter (179 zł): `price_1TYtNTEL6Ig5ZsLVBvyJZCVx`
- Standard (249 zł): `price_1TYtNVEL6Ig5ZsLVz8bAorNl`
- Premium (349 zł): `price_1TYtNWEL6Ig5ZsLVLv1zz477`
- Professional (549 zł): `price_1TYtNXEL6Ig5ZsLVh50iq9mG`
