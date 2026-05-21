# Track 25b — Trust signals + "Dlaczego tanio?" na `mixturemarketing.pl/abonament/`

> **Dla agenta pracującego nad repo `D:\KOD\Mixture\MixtureMarketing-stona`**
> Update: **2026-05-20**. Companion do [TODO-landing-pricing-update-track25.md](TODO-landing-pricing-update-track25.md) (cennik). Ten dokument = problem zaufania.

---

## Problem do rozwiązania

**Cena 179 zł/mc to ~10× taniej niż agencja WordPress (1500-3000 zł/mc).** Bez wyjaśnienia "dlaczego tak tanio" klient ma 3 podświadome obawy:

1. **"To pewnie scam / znikną za miesiąc"** — niska cena = niska wiarygodność
2. **"To pewnie szmelc / template z ThemeForest"** — niska cena = niska jakość
3. **"Coś musi być w tym haczyk"** — niska cena = ukryte koszty / lock-in / sprzedaż danych

Landing **musi rozbroić te 3 obawy w pierwszych 2 ekranach**, inaczej klient zamyka tab.

---

## 4 sekcje do dodania (lub przepisania istniejących)

### Sekcja 1: "Dlaczego tak tanio?" — TECHNOLOGIA jako wyjaśnienie

**Pozycja:** ZARAZ pod hero, PRZED pricing table (klient musi zobaczyć "dlaczego" zanim zobaczy "ile").

**Copy (sugerowany):**

> ## Dlaczego 179 zł/mc, a nie 1500?
>
> **Bo nie jesteśmy zwykłą agencją.** Tradycyjne agencje WordPress zatrudniają 5 osób, płacą za biuro w Warszawie, każdy klient = osobny serwer VPS za 100 zł/mc + administrator. To kosztuje. Stąd ich 1500-3000 zł/mc.
>
> **My zbudowaliśmy całą platformę od zera w 2025 — z myślą o automatyzacji:**
>
> ### 🤖 AI pisze treści (Anthropic Claude)
> Zamiast copywritera za 80 zł/h, **Claude Sonnet** generuje treści blogowe, opisy usług, odpowiedzi na opinie Google. Klient akceptuje jednym kliknięciem.
>
> ### ⚡ Strony działają na Cloudflare Workers (nie WordPress)
> Twoja strona to **edge worker** — uruchamia się w 300+ data center na świecie, ładuje się w 200ms zamiast 3 sekund. Hosting kosztuje nas **3 zł/mc**, nie 100.
>
> ### 🔧 Sami się automatyzujemy
> Provisioning nowego klienta = **6 minut** (nie 3 dni). Backup, SSL, monitoring, deploy — wszystko on autopilot. Bez działu IT.
>
> ### 📊 Lokalne SEO w cenie
> Wizytówka Google, Google Maps, schema.org, sitemap, llms.txt (pod AI search) — w cenie. **Inne agencje liczą to jako "dodatek 200 zł/mc".**
>
> ### 🎯 Skupiamy się na lokalnych mikrofirmach
> Robimy **jedną rzecz dobrze** — strony lokalnych usług w Polsce. Nie e-commerce, nie portale, nie SaaS. Mniejsza specjalizacja = niższy koszt = niższa cena.
>
> **Cena 179 zł to nie obniżka — to prawdziwy koszt prowadzenia strony w 2026.**

---

### Sekcja 2: "Jak to działa?" — flow w 4 krokach (z ikonami)

**Pozycja:** Po pricing table. Konkretny, mierzalny flow.

**Copy:**

> ## Jak to działa — od formularza do online w 6 minut
>
> ```
> 1. Wypełniasz formularz (3 minuty)
>    ↓ Wybierasz pakiet, podajesz NIP, nazwę, branżę, miasto
>
> 2. Płacisz przez Stripe (BLIK/karta/przelew, 1 minuta)
>    ↓ Pełna ochrona kupującego, możesz anulować w każdej chwili
>
> 3. Uzupełniasz kreator (10-15 minut)
>    ↓ Logo, zdjęcia, godziny, opis usług — w wygodnym wizardzie
>
> 4. Strona idzie online (6 minut)
>    ↓ Provisioning automatyczny: domena, SSL, DNS, GBP, llms.txt — wszystko bez Ciebie
> ```
>
> **Razem: ~25 minut od decyzji do działającej strony.** Bez maili, bez telefonów, bez "spotkania zoom z konsultantem".
>
> [Zobacz live demo →](link do publicznie dostępnego klienta-pilota, np. ślusarz-warszawa.mm-starter.workers.dev)

---

### Sekcja 3: Trust signals — REAL data, nie loga

**Pozycja:** Pod "Jak to działa", przed FAQ.

**Co umieścić:**

```
[ Box 1 ]                    [ Box 2 ]                    [ Box 3 ]
🇵🇱 NIP: 5311725473          🔐 Backup co 24h             ⚡ Status: status.mixturemarketing.pl
KRS: 0001212223              Szyfrowanie AES-GCM 256      Uptime 30 dni: 99.97%
MixtureMarketing Sp. z o.o.  R2 storage, 30-day retention Live dashboard publicly

[ Box 4 ]                    [ Box 5 ]                    [ Box 6 ]
💰 Gwarancja 30 dni          📜 RODO compliant            🛠️ Open source stack
Pełny zwrot bez pytań        DPA template (ADO/ADO)       Cloudflare + Astro + Stripe
Nie zachowujemy danych       Per-tenant encryption        (nie black box)
```

**Każdy element MUSI być prawdziwy.** Jakub potwierdzi które są live a które jeszcze TODO przed deploy:
- ✅ NIP/KRS — dopisać z dokumentów spółki
- ✅ Backup co 24h — Track C5 done, R2 + AES-GCM
- 🟡 status.mixturemarketing.pl — Better Stack TODO, jeśli jeszcze nie ma, schowaj ten box
- ✅ Gwarancja 30 dni zwrot — DECYZJA: czy dajemy? Jeśli tak — w FAQ wpisać warunki
- 🟡 RODO compliant — czeka na prawnika (Faza 0)
- ✅ Open source stack — można od razu

---

### Sekcja 4: Porównanie "My vs Agencja vs DIY Wix"

**Pozycja:** Po trust signals, przed FAQ.

**Tabela:**

| Cecha                            | MixtureMarketing 179 zł | Agencja WordPress 1500 zł | DIY Wix/Squarespace 60 zł |
|----------------------------------|--------------------------|---------------------------|----------------------------|
| **Czas do online**               | 25 minut                 | 4-8 tygodni               | 2-5 dni (sam robisz)       |
| **Lokalne SEO + GBP**            | ✅ w cenie               | 🟡 +500 zł/mc             | ❌ samemu                  |
| **AI Blog (treści automatyczne)** | ✅ Premium               | 🟡 +copywriter 400 zł/post| ❌                         |
| **Backup automatyczny**          | ✅ co 24h, szyfrowany    | 🟡 zależy od agencji      | ❌                         |
| **Hosting + SSL**                | ✅ w cenie (Cloudflare)  | 🟡 +100 zł/mc             | ✅ w cenie                 |
| **Możesz sam edytować treści**   | ✅ CMS Sveltia           | ❌ zmiany przez agencję   | ✅                         |
| **Schema.org + llms.txt (AI search)** | ✅ automatycznie    | 🟡 dodatek 200 zł         | ❌                         |
| **Wsparcie techniczne**          | ✅ email + telefon       | ✅ przez account managera | ❌ tylko forum             |
| **Lock-in**                      | ❌ kod jest twój         | 🟡 zależy od umowy        | ✅ uzależnienie od Wix     |
| **Migracja gdy odejdziesz**      | ✅ export ZIP            | 🟡 negocjowalne           | ❌ trudna                  |

**Pod tabelą:**

> 💡 **Wybór agencja vs my:** Agencja jest sensowna jeśli masz unikalny projekt na 50k zł i potrzebujesz full custom. Dla zwykłej strony lokalnej usługi — **przepłacasz za biuro i marżę**.
>
> 💡 **Wybór DIY vs my:** Wix/Squarespace działa jeśli masz 10h tygodniowo na samodzielną pracę. Jeśli wolisz **prowadzić swoją firmę a nie stronę** — bierz nas.

---

## Dodatkowe must-haves (pomniejsze)

### NIP + KRS + numer rachunku w stopce
Stopka musi zawierać **pełne dane prawne** — to base trust signal dla B2B w Polsce. Bez tego klient zakłada że to jednoosobowy garaż.

```
MixtureMarketing Sp. z o.o.
ul. [adres]
NIP: 5311725473  |  KRS: 0001212223  |  REGON: [czeka na GUS]
Sąd Rejonowy: [...]
```

### Live demo — link do działającego klienta
W hero CTA dodać **drugi przycisk** obok "Zacznij teraz":
- Główny: `[Zacznij teraz — 179 zł/mc]`
- Wtórny: `[Zobacz przykładową stronę →]` → publiczny worker (np. `ślusarz-demo.mm-starter.workers.dev`)

Bez live demo cena 179 zł brzmi jak landing page scamu.

### Sekcja "O nas / Kto za tym stoi"
Jedna twarz (Jakub) z prawdziwym zdjęciem, LinkedIn link, krótka historia "dlaczego buduję to dla agencji lokalnych w Polsce". **Anonimowy SaaS = brak zaufania**.

### Sekcja "Stack techniczny" — dla bardziej technicznych klientów
Małe logo grid:
```
Cloudflare Workers  |  Astro 5  |  Stripe  |  Resend  |  Anthropic Claude  |  Plausible
```
+ link "Pełna lista technologii: stack.mixturemarketing.pl" (TODO osobno).

---

## NIE rób (anti-patterns)

❌ **"Najtańsza strona w Polsce"** — pozycja jako tania = klient zakłada że tania jakość. Pozycja jako "uczciwa cena dzięki technologii" = klient widzi value.

❌ **Fałszywe testimoniale / "Trusted by 500+ companies"** — jeszcze nie mamy klientów. Zamiast tego: "Pierwsi klienci ruszają w maju 2026, dołącz do early adopters z gwarancją ceny na 2 lata".

❌ **Stock photos uśmiechniętych ludzi w garniturach** — wygląda jak każdy inny SaaS landing. Zamiast tego: screenshoty PRAWDZIWEGO panelu, schematy architektury, zdjęcia kodu.

❌ **Banner "Limited offer 50% off, ends in 3 days!"** — to FOMO ale niskie zaufanie. Promo "-50 zł/mc dla pierwszych 10" jest OK bo szczere.

❌ **Lista features bez kontekstu** ("✅ SSL", "✅ Backup", "✅ Hosting") — każdy SaaS to ma. Pisz **dlaczego to ważne dla Twojej firmy** ("✅ Backup co 24h — gdy klikniesz coś przez przypadek, przywracamy stan w 5 minut").

---

## Kolejność wdrożenia (sugerowana)

1. **Sekcja "Dlaczego tak tanio"** — największy impact na konwersję, ZARAZ pod hero
2. **NIP/KRS/REGON w stopce** — 5 minut, ogromny trust signal
3. **Live demo link w hero** — wymaga zdeployowanego publicznego workera (Jakub poda URL)
4. **Sekcja "Jak to działa" + ilustracja flow** — pod pricing
5. **Trust signals box grid** — przed FAQ
6. **Comparison table** — przed FAQ
7. **Sekcja "Kto za tym stoi"** — pod comparison
8. **Sekcja "Stack techniczny"** — w stopce lub linkiem na osobną podstronę

---

## Co dostaniesz od Jakuba (zapytaj jeśli brakuje)

- ✅ NIP + KRS + adres spółki (z dokumentów)
- 🟡 URL publicznego demo workera (jeszcze nie zdeployowane jako demo, do uzgodnienia)
- 🟡 Zdjęcie + LinkedIn URL do sekcji "Kto za tym stoi"
- ✅ Stripe Price IDs (już w [TODO-landing-pricing-update-track25.md](TODO-landing-pricing-update-track25.md))
- 🟡 Decyzja: gwarancja 30 dni zwrot? (jeśli tak, w FAQ jasne warunki)

---

## Test po deploy

Otwórz w incognito, mobile + desktop:
- [ ] Sekcja "Dlaczego tak tanio" widoczna w pierwszym scroll (above fold + 1 swipe)
- [ ] Pricing table z 4 tierami i nowymi cenami
- [ ] NIP/KRS widoczne w stopce każdej podstrony
- [ ] Comparison table responsive (na mobile horizontal scroll OK)
- [ ] Wszystkie linki "Zobacz demo" działają i prowadzą do realnej strony
- [ ] Modal preonboard ma 4 opcje tier i działa end-to-end (test mode Stripe)

---

**Wersja:** Track 25b v1.0 (trust signals + dlaczego tanio)
**Companion do:** [TODO-landing-pricing-update-track25.md](TODO-landing-pricing-update-track25.md)
**Kontakt:** info@mixturemarketing.pl
