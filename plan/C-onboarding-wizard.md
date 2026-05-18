# APPENDIX C — Onboarding Wizard UX Flow (12 kroków)

Wizard hosted na `binary-planet.pl/start` (część `binary-planet-marketing`). Step indicator widoczny zawsze.

**Krok 1: Wybór branży**
- 12 kafli: Ślusarz, Mechanik, Hydraulik, Elektryk, Inne rzemiosło → mapping na `craftsman`
- Księgowy, Notariusz, Architekt, Prawnik → `professional`
- Lekarz/Dentysta, Kosmetolog/Fizjo → `medical`
- Fryzjer/Paznokcie/Masaż → `beauty`
- Sprzątanie/Opieka/Transport/Naprawy → `local-services`
- "Inna" → kontakt manualny
- Walidacja: jeden wybór wymagany

**Krok 2: NIP firmy**
- Pole NIP (10 cyfr, walidacja checksum)
- Po wpisaniu: auto-call do REGON BIR1 API → autofetch (nazwa, adres, status, PKD, REGON)
- Wyświetl preview danych + checkbox "to są moje dane"
- Fallback: jeśli firma niezarejestrowana (jednoosobowa działalność, jeszcze nie wpisana) → manual input

**Krok 3: Lokalizacja i zasięg działania**
- Główne miasto (autocomplete na bazie OSM Nominatim)
- Service area: tryby
  - "W moim mieście" → wszystkie dzielnice z OSM
  - "Promień km" → slider 5–100 km
  - "Lista miast" → multiselect najbliższych
- Lista dzielnic checkbox (do programmatic pages — max 10 wybranych żeby trzymać <40 podstron przy 4 services)
- Walidacja: min 1 lokalizacja

**Krok 4: Wybór theme preset + wariantu kolorystycznego**
- Pokazuje 5 wariantów kolorystycznych dla wybranego presetu (z kroku 1)
- Live preview iframe z wstępnie zastosowanym branding
- Możliwość zmiany presetu (jeśli np. kosmetolog chce `professional` zamiast `medical`)
- Walidacja: wybór wariantu wymagany

**Krok 5: Brand**
- Upload logo (lub generator AI z nazwy firmy via Anthropic + image gen)
- Upload favicon (auto z logo jeśli nie podane)
- Wybór font pair z 5 opcji safe dla branży
- Color picker dla 1 customowego (akcent) ponad preset

**Krok 6: Usługi**
- Lista podstawowych usług (max 8) — auto-suggested z PKD + typowe dla branży
- Per usługa: nazwa, krótki opis, opcjonalnie cena orientacyjna
- Walidacja: min 3 usługi

**Krok 7: Godziny otwarcia**
- Tabela dni tygodnia
- Per dzień: zamknięte / 24h / godziny od-do
- Quick presets: "Pn-Pt 8-17", "Pn-Sob 9-18 + Nd zamknięte", "24/7"
- Strefa czasowa: Europe/Warsaw (default, edytowalne)

**Krok 8: Zdjęcia**
- Upload 5–15 zdjęć (drag&drop)
- Lub: "Użyj zdjęć stockowych dla branży" (zestaw 20 zdjęć curated per preset z Unsplash + CC0)
- Lub: "Generuj AI" (Anthropic image gen, dłuższe — async, email kiedy gotowe)
- Auto-crop + WebP/AVIF conversion w runtime przez CF Images

**Krok 9: Dane kontaktowe**
- Telefon (z walidacją PL format +48)
- Email (z walidacją + DKIM check)
- Adres (z REGON autofetch, edytowalny)
- Opcjonalnie: WhatsApp, Messenger, GBP Place ID (z guide jak znaleźć)

**Krok 10: AI Content Generation**
- Pole "Krótko o sobie/firmie" (5–15 zdań, własnymi słowami)
- Pole "USP — czym się wyróżniacie?" (3–5 zdań)
- Pole "Typowi klienci — kto do was przychodzi?" (opcjonalne)
- Po wypełnieniu: progress bar "AI generuje treść strony..." (15–30s)
- Wyświetl preview: hero copy, about us, service descriptions, FAQ
- Klient może edytować inline lub regenerate poszczególne sekcje

**Krok 11: Wybór pakietu + płatność**
- 3 karty: Starter (99 zł/mc) / Standard (299 zł/mc) / Premium (599 zł/mc)
- Toggle: "0 zł setup z lock-in 12 mc" vs "299/499/799 zł setup bez lock-in"
- Per pakiet: bullet list co dostaje + szczegóły
- Add-ons: GEO module +149 zł, Multi-location +79 zł/lokalizacja, Extra blog +49 zł/post
- Akceptacja: Regulamin + Polityka prywatności + **DPA** (link do PDF) — 3 checkboxy wymagane
- Płatność: Stripe Checkout (karty SEPA EU) lub Przelewy24 (BLIK, przelewy PL, karty PL)
- Po sukcesie: redirect na "Sukces" + powiadomienie webhook

**Krok 12: DNS + Email confirmation**
- Strona "Dziękujemy!" z wyjaśnieniem co dalej:
  - "W ciągu 30 minut Twoja strona będzie gotowa pod adresem testowym: `[client-id].binary-planet.pl`"
  - "Aby uruchomić ją pod własną domeną, dodaj rekordy DNS:" (wyświetla CNAME do CF for SaaS)
  - "Albo: zarejestrujemy domenę za Ciebie (+39 zł/rok)" — opcja zakupu via OVH API
  - Email z linkami do panelu Sveltia CMS + access do dashboard klienta + DPA PDF do podpisu

**Telemetria każdego kroku:** track abandonment rate, time per step, regenerate clicks. Drop-off >30% w jednym kroku = trigger do iteracji UX.

---
