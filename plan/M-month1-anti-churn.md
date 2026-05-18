# APPENDIX M — Quick Wins Month 1 (anti-churn plan)

Klient płaci 149+ zł/mc i ma psychologiczną potrzebę zobaczyć value w pierwszych tygodniach. SEO efekty po 3–6 mc → trzeba zaplanować **widoczne rezultaty w 30 dni** żeby uniknąć churn w month 2-3.

## M.1 Day 1–3 (auto, ~zero pracy)

- Strona live na test domain w <30 min od płatności
- Lighthouse score 95+ — automatyczny email "Twoja strona uzyskała 98/100 w Lighthouse vs średnia 45 w branży"
- llms.txt + sitemap + robots — automatyczne, świadczy o jakości

## M.2 Day 1–7 (część "Care + Local Basic" tieru Starter)

- **GBP setup / optimization** (twoja praca 15–30 min):
  - Wszystkie pola wypełnione 100%
  - Kategorie poprawne (primary + secondary)
  - Godziny otwarcia dokładnie jak w client.config.ts
  - Atrybuty: parking, dostępność, payment methods
  - 10 zdjęć (zdjęcia z wizardu lub stock per branża)
  - Q&A 5 pytań pre-filled z FAQ
  - GBP w mapach widoczny w 7-14 dni (effect)

- **Wpis do 5 katalogów** (auto + półauto):
  - Bing Places (API), Apple Business (API), Panorama Firm, pkt.pl, branżowy
  - Email do klienta: "Twoja firma jest już widoczna na 5 platformach"

## M.3 Day 7–14

- **Pierwsza recenzja przez SMS automation:**
  - Klient dodaje kilku ostatnich klientów (5–10 osób) → SMS request z linkiem do GBP
  - Cel: 2–4 nowe ★★★★★ w pierwszym miesiącu
  - Visible boost w GBP — psychologicznie "działa"

- **Pierwsza widoczność w Google:**
  - GSC submitted, sitemap indexed
  - Brand name w Google → strona pojawia się w wyniku #1 (zawsze, dla brand search)
  - Email do klienta: "Wpisz w Google 'nazwa twojej firmy' — jesteś na pierwszym miejscu!"

## M.4 Day 14–30

- **Pierwszy lead z formularza** (jeśli ruch jakikolwiek):
  - Notyfikacja SMS + email do klienta natychmiast
  - W panelu Sveltia widzi historię leadów

- **Local pack appearance:**
  - Dla podstawowego brand query klient pojawia się w local pack (po 14-21 dniach od GBP setup)
  - Email z screenshot "Jesteś w map pack dla 'ślusarz [twoje miasto]'"

- **Day 30 report:**
  - Profesjonalny PDF z metrykami: 245 wyświetleń GBP, 18 telefonów, 12 zapytań o trasę, 1.2k impressions w GSC, ★★★★☆ (4.7) z 3 nowych opinii
  - Wartość: pokazujesz czarno na białym wartość 149 zł

## M.5 Indicator: jeśli klient nie zobaczył żadnego z powyższych w 30 dni

→ Trigger w dashboardzie (`/clients/[id]/health = "no_value_yet"`) → manual outreach Jakub → diagnoza problemu (niska conversion form? GBP nie zweryfikowane? domena nie podpięta?) → quick fix.

---
