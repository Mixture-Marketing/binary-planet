# Konsultacja prawnik RODO/IT — Lista pytań

**Budżet:** 5–10k zł (świadomy wybór, plan U.5)
**Cel:** maksymalne wykorzystanie 1 jednorazowej konsultacji (bez retainera).
**Forma:** preferowana zdalna (zoom), wcześniej przesłany ten dokument + plan w skrócie.
**Stan obecny:** MixtureMarketing ma regulamin świadczenia usług + politykę prywatności. **Brak DPA template, brak update pod model SaaS subskrypcji.**

---

## Kontekst do przesłania prawnikowi PRZED konsultacją (1-pager)

```
MixtureMarketing rozszerza usługi o produkt SaaS: subskrypcyjne strony www
+ pozycjonowanie local SEO dla mikrofirm (149–299 zł/mc).

Każdy klient dostaje:
- Osobną stronę na własnej domenie (hostowaną przez nas na Cloudflare)
- Panel do edycji treści (Sveltia CMS, git-based)
- Formularz kontaktowy (lead capture)
- Integrację z Google Business Profile (auto-postowanie, monitoring opinii)
- Miesięczny raport SEO (PDF)
- Opcjonalnie: blog generowany przez AI (Anthropic Claude)

Model danych:
- MY (controller): klienci agencji, billing, dane CRM
- MY (processor): leady końcowych klientów z formularzy na ich stronach,
  treść opinii GBP, IP logs odwiedzających strony klientów

Sub-procesory: Cloudflare (US, DPF), Anthropic (US, DPF), Resend (US, DPF),
SMSAPI (PL), Stripe (US/IE, DPF+SCC), Przelewy24 (PL), Fakturownia (PL).

Ryzyka, których jestem świadomy:
- Per-tenant encryption PII w D1 (planujemy zbudować)
- Brak DPA = naruszenie Art. 28 RODO (kary do 30 mln zł / 4% obrotu)
- Pierwsze 10 klientów: NIE medical, NIE legal (ograniczenie ryzyka)
- OC IT/cyber 500k zł zaplanowane

Cel konsultacji: domknąć compliance PRZED pierwszym klientem.
```

---

## Część I — DPA (Data Processing Agreement) — KLUCZOWE

1. Czy istniejący regulamin świadczenia usług MixtureMarketing **wystarcza dla modelu SaaS subskrypcji** czy potrzebuje aneksu/odrębnego dokumentu?
2. Czy DPA może być **częścią umowy głównej** (1 dokument), czy lepiej osobny załącznik (lepsza praktyka)?
3. **DPA template** — czy mogę dostać draft pod nasz konkretny model, czy potrzeba customu per klient? Czy template z odo24.pl / GIODO wystarcza jako baza?
4. Jakie elementy z Art. 28 RODO są w naszym przypadku **najczęściej pomijane** przez SaaS-y i kończą się kontrolą UODO?
5. Czy wystarczy **podpis elektroniczny niekwalifikowany** (DocuSign/Autenti/click-through) czy potrzeba kwalifikowanego dla DPA?
6. Lista sub-procesorów — czy **automatyczne powiadomienie email + 30-dniowy okres sprzeciwu** wystarcza, czy każda zmiana wymaga zgody klienta podpisanej?
7. **Odpowiedzialność** — limit do 2× wartości rocznej subskrypcji jest standardem czy ryzykowny prawnie?

## Część II — Status processor vs controller — pułapki

8. Dla formularzy kontaktowych na stronach klientów: **kto jest controllerem leadów?** (mikrofirma-klient, my, czy współcontrollerstwo Art. 26)?
9. Klauzula informacyjna Art. 13 RODO w formularzach — czy **my** dostarczamy template, czy klient odpowiada za jej treść?
10. Cookie banner — jeśli klient włącza GA4/Meta Pixel, **kto jest controllerem cookies**? (klient — bo to jego marketing) — jak to napisać w DPA?
11. Logi serwera (IP, user agent) na CF — czy są danymi osobowymi w naszej architekturze i **przez ile dni** możemy je trzymać legalnie? (cel: 30 dni rate-limit + security)
12. Anthropic API (Claude) generuje treści marketingowe — **czy treść klienta wpadająca do promptu jest "transferem danych" do USA**? Czy DPF Anthropic to wystarczająca podstawa?

## Część III — Regulamin świadczenia usług (UPDATE istniejącego)

13. SLA — jakie **minimalne SLA** rekomendujesz dla naszego modelu cenowego (uptime %, response time, fix time)? Co kończy się pozwami?
14. **Cancellation policy** — model subskrypcji miesięcznej z opcją lock-in 12 mc — jakie klauzule wymagane (prawo konsumenta, B2B vs B2C — wszyscy klienci to firmy)?
15. **Refund policy** — pierwsze 14 dni? Pro-rata? Brak zwrotów? Co dopuszcza prawo polskie dla B2B?
16. **Wypowiedzenie umowy z naszej strony** — w jakich warunkach możemy zerwać (np. klient narusza CSAM/spam/oszustwa)?
17. **Eksport danych po zakończeniu** — 30 dni eksport + 60 dni permanent delete (z planu) — czy to OK?
18. **Domena klienta** — jeśli klient kupuje domenę przez nas (OVH) — czyja jest własnością? Jak napisać klauzulę żeby uniknąć sporów?

## Część IV — Polityka prywatności (UPDATE)

19. Czy obecna polityka prywatności obejmuje **rolę processora**? Co dodać?
20. Sub-procesory — czy lista musi być **w polityce**, czy wystarczy w DPA?
21. **Right to be forgotten** — wniosek odwiedzającego stronę klienta przychodzi do nas czy do klienta? Procedura?
22. Wniosek o dostęp do danych (Art. 15) — kto odpowiada w 30 dni — my czy klient?

## Część V — Branże ryzykowne i ograniczenia

23. **Medical/legal/finansowe** — co dokładnie nas ogranicza? Czy klauzula odpowiedzialności klienta wystarcza, czy potrzeba dodatkowych certyfikatów (np. dla medical)?
24. Treści generowane przez AI (Claude) — kto odpowiada za błędy merytoryczne na stronie klienta? Klient po akceptacji, czy współodpowiedzialność?
25. **Rich Results / Schema.org** — fałszywe dane w schema (np. fake reviews) — odpowiedzialność karna? Jak się zabezpieczyć?
26. **Polskie przepisy konsumenckie** — czy mikrofirma korzystająca z naszych usług jest "przedsiębiorcą-konsumentem" (jednoosobowa działalność, niezwiązane z branżą IT)?

## Część VI — Compliance operacyjny

27. **Rejestr czynności przetwarzania (Art. 30)** — wymagany dla nas (poniżej 250 osób)? Jak prowadzić (D1 + manual doc)?
28. **DPIA (Data Protection Impact Assessment)** — wymagana? Kiedy?
29. **DPO / Inspektor Ochrony Danych** — czy musimy wyznaczyć, czy wystarczy zwykły kontakt RODO?
30. **Breach notification** — 72h do UODO, 24h do klientów (z planu) — procedura, template, archiwum?
31. **Rejestracja zbioru danych** — czy w 2026 jest jeszcze wymagana, czy wystarczy rejestr Art. 30?

## Część VII — OC IT/cyber

32. **OC IT cyber 500k zł** — wystarczy dla naszego ryzyka (do 50–100 klientów)? Konkretne rekomendacje ubezpieczyciela (Hestia, Warta, PZU)?
33. Co MUSI być w polisie żeby pokryła breach (kary UODO, koszty notyfikacji, koszty obrony prawnej, koszty PR)?

## Część VIII — Cold outreach + marketing

34. **Cold call mikrofirmom** — czy wymagane jest sprawdzanie GIODO Rejestr Zastrzeżeń / opt-in z bazą?
35. **Cold email** — wymaga uprzedniej zgody (Art. 10 ustawy o świadczeniu usług elektronicznych)? Wyjątek B2B?
36. Skrypt cold call + template email (przyślę draft) — review pod kątem ryzyka prawnego?

## Część IX — Umowa z VA (Wirtualną Asystentką) na fazę 8

37. Jeśli zatrudniam VA (B2B umowa o dzieło/zlecenie) do batch approval treści — **jakie klauzule poufności + RODO** musi mieć? Czy VA staje się sub-procesorem (wpisać w DPA klientów)?

---

## Deliverables oczekiwane od prawnika (after konsultacji)

1. **DPA template** (PL + EN wersje, jeśli możliwe — niektórzy klienci mogą być angielskojęzyczni)
2. **Aneks do regulaminu** pod model SaaS subskrypcji (lub nowy regulamin "Usług SaaS")
3. **Update polityki prywatności** z processor role + sub-procesory
4. **Klauzula informacyjna Art. 13** template do formularzy klientów
5. **Cookie consent banner copy** template (PL + EN)
6. **Breach notification procedure** (1-pager: kto, kiedy, gdzie, co)
7. **Lista najwyższych ryzyk** z mojego modelu z rekomendacjami mitigation
8. **Pisemna opinia** na 1–2 strony z kluczowymi rekomendacjami (do archiwum jako proof of due diligence)

---

## Jak znaleźć prawnika

**Kryteria:**
- Specjalizacja: RODO + IT/SaaS (nie ogólny korporacyjny)
- Doświadczenie z mikrofirmami / startupami (nie tylko enterprise)
- Stawka godzinowa 300–600 zł/h (5–10k zł = 15–30h pracy)
- Możliwość zdalnej konsultacji

**Rekomendacje (do researchu):**
- Kancelarie z dorobkiem RODO/IT widocznym publicznie (blog, artykuły, podcasty)
- ODO 24 / Lex Digital / Maruta Wachta / Bird & Bird PL (większe — pewnie drożej)
- Indywidualni adwokaci ze specjalizacją RODO — często tańsi, dobre rezultaty
- LinkedIn search: "RODO" + "SaaS" + "Polska" + "kancelaria"

**Pytania na pierwszą rozmowę (zanim zaangażujesz):**
- Doświadczenie z B2B SaaS Polska? (referencje)
- Czy template DPA i regulamin SaaS są w portfolio?
- Stawka godzinowa lub flat fee za konkretny zakres?
- Czas realizacji deliverables (ile dni od konsultacji)?

---

## Status

- [ ] **2026-05-18** — lista pytań gotowa
- [ ] Research 3–5 kancelarii
- [ ] Wybór + first call (free 15 min)
- [ ] Wysłanie kontekstu + listy pytań
- [ ] Konsultacja (2–3h)
- [ ] Otrzymanie deliverables
- [ ] Wdrożenie w starter + control plane
