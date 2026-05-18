# APPENDIX A — RODO/GDPR Compliance (KRYTYCZNE)

Operujemy jako **podwójna rola** w sensie RODO:
- **Administrator danych** (controller) — dla danych własnej działalności (klienci agencji, billing)
- **Podmiot przetwarzający** (processor) — dla danych klientów końcowych klientów (leady z formularzy, recenzje GBP, IP logs)

Brak DPA z każdym klientem = naruszenie Art. 28 RODO, kara UODO do 30 mln zł lub 4% rocznego obrotu.

## A.1 DPA — Data Processing Agreement (template w core)

Każdy klient przy onboardingu MUSI podpisać DPA (digital signature via DocuSign alt. Autenti). Template w core, generowany dynamicznie z `client.config.ts`:

**Wymagane elementy (Art. 28 RODO):**
1. **Przedmiot i cel** — hosting strony, processing leadów z formularzy, processing GBP API responses
2. **Czas trwania** — okres trwania subskrypcji
3. **Kategorie danych osobowych** — imię, nazwisko, email, telefon, IP, treść wiadomości w formularzu
4. **Kategorie podmiotów danych** — odwiedzający stronę klienta, leady, autorzy opinii GBP
5. **Obowiązki i prawa administratora** — instrukcje klienta, prawo audytu, lista sub-procesorów
6. **Sub-procesory** (lista z prawem sprzeciwu w 30 dni):
   - Cloudflare Inc. (hosting) — DPF certified
   - Anthropic PBC (AI content) — DPF certified
   - Resend Inc. (email delivery) — DPF certified
   - SMSAPI sp. z o.o. (SMS) — PL
   - Stripe Inc. + Przelewy24 SA (payments) — DPF + PL
   - OpenAI Inc. (jeśli używany backup LLM) — DPF certified
7. **Bezpieczeństwo** — wymienione konkretne środki: szyfrowanie TLS 1.3, encryption-at-rest (CF R2/D1), CSP headers, security headers A+, rate limiting, 2FA na ich kontach
8. **Współpraca przy realizacji praw** — 72h response time na żądania (dostęp, sprostowanie, usunięcie, przeniesienie)
9. **Naruszenia** — powiadomienie klienta w 24h od wykrycia
10. **Usunięcie/zwrot** — po zakończeniu subskrypcji eksport danych w 30 dni + permanent delete w 60 dni
11. **Audyt** — prawo klienta do audytu 1x rocznie, koszt audytu po stronie klienta
12. **Odpowiedzialność** — limit do 2× wartości rocznej subskrypcji

Template oparty na wzorach z odo24.pl i baza-prawa.pl, weryfikacja prawnika przed launch.

## A.2 Cookie consent (BANNER OBOWIĄZKOWY)

**Kluczowe odkrycie z researchu:** Cloudflare Web Analytics WYMAGA cookie consent w PL (ustawia cookies security/performance). To było moim błędnym założeniem wcześniej.

**Strategia w `core/consent`:**
- **Default analytics: Plausible self-hosted** (no cookies, no consent needed — legalne bez bannera w PL/EU)
- **Optional add-ons (wymagają consent):**
  - Cloudflare Web Analytics
  - Microsoft Clarity (heatmaps + session recording = personal data!)
  - Google Analytics 4 (jeśli klient sobie życzy)
  - Facebook Pixel (jeśli klient sobie życzy)

**Banner zgodny z RODO + ePrivacy:**
- 3 kategorie: **Niezbędne** (always on, no consent) / **Analityczne** (opt-in) / **Marketingowe** (opt-in)
- Granular per-category opt-in (NIE jeden "Akceptuj wszystko" bez wyboru)
- Visible "Odrzuć" tak samo widoczne jak "Akceptuj" (UODO 2025 wytyczne)
- Persistent decision w localStorage + audit log w D1 (timestamp, IP-hash, choice)
- Link do polityki prywatności w stopce
- Możliwość wycofania zgody przez ikonę "Ustawienia cookies" w stopce

## A.3 Polityka prywatności + Regulamin (auto-generowane per klient)

W core: generator HTML/markdown polityki prywatności z `client.config.ts` + lista włączonych modułów (jeśli Clarity → wzmianka o session recording, jeśli Resend → wzmianka o email).

Template polityki zawiera:
- Dane administratora (z REGON autofetch)
- Cele i podstawy prawne przetwarzania
- Kategorie danych
- Okresy retencji (lead w D1: 24 mc, IP logs: 30 dni, GBP reviews: bezterminowo — dane publiczne)
- Odbiorcy danych (sub-procesory z DPA)
- Prawa osoby (dostęp, sprostowanie, usunięcie, ograniczenie, przeniesienie, sprzeciw, skarga do UODO)
- Cookie policy embedded

## A.4 IODO / DPO

**Wniosek:** Mała agencja (1–3 osoby) operująca w skali <10 000 klientów końcowych NIE jest zobowiązana do wyznaczenia DPO (Art. 37 RODO).

**Ale:** zalecane wyznaczenie wewnętrzne osoby odpowiedzialnej za RODO (Ty na start). Notyfikacja UODO opcjonalna.

**Trigger do obowiązkowego DPO:** systematyczne i masowe monitorowanie (≥10 000 osób) lub przetwarzanie szczególnych kategorii (zdrowie, religia) na dużą skalę. Przy 250+ klientach z mediów medycznych — review z prawnikiem.

## A.5 Transfer danych do USA

Cloudflare, Anthropic, Resend, Stripe są **DPF certified** (EU-US Data Privacy Framework, stan na 2026). Legal transfer + SCCs jako backup.

**Ryzyko:** DPF opiera się na executive order, może być uchylony nowym administracją USA. Mitigation: w DPA klauzula że w razie unieważnienia DPF, agencja przejdzie na alternatywne providery (cm. Hetzner EU + Mistral EU dla AI) w 90 dni.

## A.6 Operacyjne TODO

W fazie 0:
- [ ] Konsultacja z prawnikiem specjalizującym się w RODO/IT (~2–3k zł jednorazowo)
- [ ] Stworzenie pierwotnego DPA template
- [ ] Stworzenie polityki prywatności template
- [ ] Stworzenie regulaminu świadczenia usług template
- [ ] Wpis do rejestru czynności przetwarzania (RCP) własnej agencji
- [ ] Sub-procesory list w `core/consent` + DPA template

---
