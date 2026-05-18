# APPENDIX T — Action Items / Plan po review

## T.1 Decyzje wymagane od Jakuba

1. **Czy robimy Fazę -1 (walidacja rynku) przed budową techniki?**
   - Tak (rekomendacja 5/5 agentów): odraczamy budowę o 4-6 tyg, oszczędzamy potencjalnie 6 mc i 30-50k zł
   - Nie: ryzykujemy budowę produktu którego nikt nie kupi

2. **Czy wykluczamy medical/legal z MVP?**
   - Tak (rekomendacja): eliminujemy ryzyko AI Act + odpowiedzialność deliktowa
   - Nie: dodajemy znaczącą złożoność compliance

3. **Czy upraszczamy do 2 tierów (Starter + Standard) zamiast 3?**
   - Tak (rekomendacja): eliminujemy kanibalizację Premium, prościej w marketing
   - Nie: trzymamy 3 tiery z ryzykiem

4. **Czy multi-tenant single Worker dla runtime (zamiast 1 Worker per klient)?**
   - Tak: skaluje lepiej, prostsze update propagation, ale wymaga rewizji isolation
   - Nie: prościej teraz, problem przy 100+ klientach

5. **Budżet prawny rok 1 — czy gotowy na 25-50k zł?**
   - Tak: pełna compliance, ubezpieczenie przed UODO
   - Częściowo (~15-20k): podstawowe dokumenty, retainer pomijamy
   - Nie: ryzyko kary do 4% obrotu rocznego

6. **VA hire — kiedy uruchamiamy?**
   - 40 klientów (rekomendacja): proaktywne, ROI od 50 klientów
   - 80+ klientów: oszczędność krótkoterminowa, burnout risk

## T.2 Ścieżka decyzyjna

```
Czy zaakceptować plan jak jest? → NIE (5/5 review NEEDS REWORK)
       │
       ▼
Czy zrobić Fazę -1 walidacji rynku? 
       │
       ├── TAK → 4-6 tyg walidacji → decyzja GO/PIVOT/NO-GO
       │           │
       │           ├── GO → Update plan z 15+ zmianami → Faza 0
       │           ├── PIVOT → Zmiana target/positioning/pricing
       │           └── NO-GO → Inny pomysł biznesowy
       │
       └── NIE → BEZPOŚREDNIO Faza 0 ale z aktualizacjami:
                 - Wykluczyć medical/legal z MVP
                 - 2 tiery zamiast 3
                 - Branżowe SEO playbooki przed Fazą 2
                 - Storage split: D1 + AE + Logpush
                 - Multi-tenancy isolation: repository + linting
                 - Realne ekonomika (95-130h/mc, 50-70 break-even)
                 - Budżet prawny 25-50k zł
                 - VA przy 40 klientach
```

## T.3 Co teraz?

Trzy opcje:

**Opcja A — Faza -1 walidacji (rekomendacja 5/5 agentów):**
- Odraczamy techniczną budowę o 4-6 tyg
- Sprzedajemy ręcznie 5 stron (manual, bez automatyzacji)
- Customer discovery 15 interviews
- Google Ads fake door test (200 zł)
- Po 4-6 tyg: decyzja czy budujemy automat (na podstawie REAL signals)
- **Ryzyko: małe.** Potencjalna oszczędność: 6 mc + 30-50k zł.

**Opcja B — Aktualizujemy plan z najważniejszymi zmianami i startujemy Fazę 0:**
- Implementujemy 15+ kluczowych zmian (medical exclude, 2 tiery, storage split, real economics)
- Wchodzimy w Fazę 0 z dopracowanym planem ale BEZ walidacji rynku
- **Ryzyko: wyższe.** Budujemy 4-6 mc bez sygnału z rynku.

**Opcja C — Trzymamy plan w obecnej formie i jedziemy:**
- Akceptujemy verdict 5/5 agentów "NEEDS REWORK" ale jedziemy
- **Ryzyko: wysokie.** Możemy zbudować coś czego nikt nie kupi lub przegrać na compliance.

---
