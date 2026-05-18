# APPENDIX V — Cold Outreach Sales Pipeline (pre-validation + akwizycja)

Zamiast Faza -1 z fake door testem, robimy **cold outreach od dnia 1** (równolegle z Fazą 0-1 budowy). To pre-validation + pierwszy kanał akwizycji jednocześnie.

## V.1 Strategia

**Cel:** zanim zbudujemy automat, **mieć na liście rezerwacji 10-20 ciepłych leadów** którzy powiedzieli "tak, gdy będzie gotowe — wezmę". Pierwsi 5 to klienci pilotażowi (Faza 4).

**Kanały (priorytet wg ROI dla mikrofirm w PL):**

### V.1.1 Cold call (najwyższy ROI dla local target)

**Profil targetu:** firmy w Rzeszowie (i okolicach) bez własnej strony LUB ze strony przestarzałej (rok 2010-2015, brak SSL, brak mobile, nieaktualne dane).

**Discovery list (jak znaleźć):**
- Wyszukiwarka pkt.pl filtr branża + miasto → telefony zazwyczaj podane
- Panorama Firm — to samo
- GBP search "ślusarz Rzeszów" + Maps eksport — telefony
- LinkedIn Sales Navigator (płatny, ~250 zł/mc) — firmy zarządzane przez właściciela <10 osób w danym mieście
- Lokalne grupy Facebook ("Rzeszów biznes", "Mikrofirmy Podkarpacie") — obserwuj kto się reklamuje organicznie, ma słabą stronę

**Cele: 30-50 telefonów dziennie, 5-10 zdobytych zainteresowanych:**

**Skrypt cold call (PL, 60-90 sek):**
```
"Dzień dobry, [Imię klienta]? Tu Jakub z [nazwa firmy].

Nie sprzedaję dziś — proszę o 60 sekund.

Buduję usługę gdzie mała firma w Rzeszowie dostaje 
profesjonalną stronę z pozycjonowaniem za 149-299 zł 
miesięcznie. Bez setup fee na start.

Zastanawiam się czy taka oferta byłaby dla Pana 
interesująca — czy w ogóle szuka Pan/Pani teraz 
sposobu na pozyskanie więcej klientów z Internetu?"

[czekaj na odpowiedź]

Jeśli TAK: "Świetnie. Mogę wysłać krótki opis na 
SMS-a / email z linkiem do strony przykładowej — 
i odezwę się ponownie za tydzień. Telefon?"

Jeśli NIE: "Rozumiem. Czy znajdą się 2-3 znajome 
firmy które mogłyby tym być zainteresowane? Polecenia 
jak najbardziej mile widziane."

Jeśli MOŻE / NIE WIEM: "Zostawię swój kontakt, jeśli 
zmieni się sytuacja proszę pisać. Dziękuję za czas."
```

**Cel statystyczny:**
- 100 telefonów dziennie → realnie 60 odebranych
- 60 odebranych → 8-12 zainteresowanych (15-20%)
- 8-12 zainteresowanych → 1-3 zamykalnych klientów (cold + nurture)

**Codzienna rutyna:** 2-3h dziennie cold calling, jeśli chcesz 5 klientów/tydzień.

### V.1.2 Cold email (uzupełnienie, niższa konwersja ale skala)

**List source:** ten sam co dla cold call (pkt.pl, Panorama, GBP).

**Template (PL, max 100 słów):**
```
Subject: [Imię], czy strona [nazwa firmy] daje 
         Wam dziś klientów z Google?

Cześć [Imię],

Zauważyłem że [nazwa firmy] [konkretny problem 
strony — brak SSL, nieaktualna, brak na Google Maps, 
brak telefonu klikalnego].

Pomagam mikrofirmom w Rzeszowie mieć stronę która 
generuje 5-15 leadów miesięcznie. Cena: 149 zł/mc, 
bez setup fee.

Mogę wysłać przykład strony którą zrobiłem dla 
[podobna branża] w 2 minuty?

[Imię]
[Telefon]
[Link do landing/portfolio]
```

**Cele:** 50 maili dziennie → 8-12 open → 2-3 reply → 1 conversion. Wymaga **warmowania domeny** 2-3 tygodnie przed startem (NeverBounce + Resend), inaczej trafia w spam.

### V.1.3 Polecenia od pierwszych klientów

Po pierwszych 5 klientach pilotażowych: zaproponuj im **1 mc free dla obu** za polecenie. Local mikrofirmy mają silne sieci (cech, izba, polecenia ustne).

### V.1.4 Partnerstwa B2B2C (długoterminowe, najwyższy LTV)

**Targety:**
- **Biura rachunkowe** — obsługują 50-200 mikrofirm. Partner dostaje 20% od każdej sprzedaży przez polecenie.
- **Lokalne izby gospodarcze** — wpis sponsorowany w newsletterze, prezentacja na evencie.
- **Doradcy podatkowi** — same target jak biura rachunkowe.

**Pierwsze 5 partnerstw = 50-100 leadów ciepłych w 3-6 miesiącu.**

## V.2 Pipeline & metryki

CRM (w control plane, Appendix L) ma `prospects` table. Każdy contact ma source: `cold_call`, `cold_email`, `referral`, `partnership`, `inbound`.

**KPI minimalne:**
- 100 outreach activities/tydzień
- 15-20 conversations/tydzień (połączenia + reply)
- 3-5 qualified prospects/tydzień
- 1-2 closed/tydzień
- 4-8 closed/mc po pierwszych 2 mc warmowania

**Próg GO/PIVOT (po 4 tyg cold outreach):**
- **GO**: ≥3 closed klientów = potwierdzenie product-market fit, kontynuuj
- **PIVOT**: 0-2 closed = problem w price/positioning/segment. Zmień jedno (np. niższa cena 99 zł, inna branża, inna lokalizacja) i testuj kolejne 4 tyg
- **NO-GO**: 0 closed po 8 tyg z 2 pivotami = porzucamy biznes, plan nie ma sensu

## V.3 Materiały do przygotowania w Fazie 0 (tydzień 2)

- [ ] Lista 200 firm w Rzeszowie (cold call list, posegregowana branżami)
- [ ] CRM setup w control plane (`prospects` table działająca)
- [ ] Skrypt cold call (PL)
- [ ] Template cold email + email warming setup (Resend + DKIM + SPF)
- [ ] Landing page proste (1 strona, "in development" + form rezerwacji)
- [ ] Mockupy 3 przykładowych stron (po jednym z każdej branży: ślusarz, księgowy, beauty)
- [ ] Ulotka A4 / one-pager PDF z ofertą + cenami
- [ ] LinkedIn profile zaktualizowany + posts o budowaniu produktu

---
