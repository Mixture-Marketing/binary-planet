# REGON BIR1 API — wniosek do GUS

**Czas oczekiwania:** 1–2 tygodnie od wysłania.
**Adresat:** GUS — Departament Metainformacji
**Kontakt:** [bir.bir@stat.gov.pl](mailto:bir.bir@stat.gov.pl)
**Strona z dokumentacją:** https://api.stat.gov.pl/Home/RegonApi

---

## Procedura (stan na 2026)

1. Wysłać email na `bir.bir@stat.gov.pl` z wnioskiem o nadanie klucza użytkownika do API BIR1.
2. GUS odsyła **kwestionariusz/formularz rejestracyjny** do uzupełnienia (zwykle w ciągu 3–5 dni roboczych).
3. Uzupełniony formularz odesłać podpisany (skan/PDF z podpisem elektronicznym lub kwalifikowanym).
4. GUS generuje **klucz użytkownika** (User-Key) i odsyła mailem. Działa od razu na środowisku **produkcyjnym**.
5. (Opcjonalnie) klucz testowy: `abcde12345abcde12345` — środowisko `wyszukiwarkaregontest` (publiczny, do developmentu).

---

## Template maila (PL)

```
Temat: Wniosek o klucz dostępu do API REGON BIR1 — MixtureMarketing [NIP]

Szanowni Państwo,

W imieniu przedsiębiorstwa MixtureMarketing [pełna nazwa firmy zgodna z CEIDG/KRS],
NIP: [NIP firmy],
REGON: [REGON firmy],
adres siedziby: [pełny adres],

zwracam się z prośbą o nadanie klucza użytkownika do API REGON BIR1
(środowisko produkcyjne).

Cel wykorzystania danych:
Świadczenie usług projektowania i hostingu stron internetowych dla
mikroprzedsiębiorstw w Polsce. W procesie onboardingu klienta integrujemy
wyszukiwarkę po numerze NIP w celu automatycznego pobrania danych
rejestrowych firmy (nazwa, adres, kody PKD), co skraca czas konfiguracji
strony oraz minimalizuje ryzyko błędów w danych firmowych klienta.

Dane będą wykorzystywane wyłącznie na potrzeby weryfikacji i autouzupełniania
formularza onboardingu — nie będą redystrybuowane ani odsprzedawane,
zgodnie z regulaminem korzystania z API BIR.

Szacowana liczba zapytań: do 500 / miesiąc w fazie startowej,
docelowo do 5000 / miesiąc po roku działalności.

Osoba kontaktowa techniczna:
Jakub [Nazwisko]
email: info@mixturemarketing.pl
tel: [+48 ...]

Proszę o przesłanie formularza rejestracyjnego oraz instrukcji dalszego
postępowania.

Z poważaniem,
Jakub [Nazwisko]
[Stanowisko, np. Założyciel / Właściciel]
MixtureMarketing
[NIP firmy]
```

---

## Co przygotować PRZED wysłaniem maila

- [ ] Pełna nazwa firmy zgodna z CEIDG (sprawdź: https://aplikacja.ceidg.gov.pl/)
- [ ] NIP, REGON firmy (z CEIDG/KRS)
- [ ] Adres siedziby
- [ ] Kod PKD (powinien obejmować PKD 62.01 / 62.02 / 63.11 — IT/hosting)
- [ ] Profil zaufany lub podpis kwalifikowany (do podpisu formularza zwrotnego)
- [ ] Plan utrzymania klucza po stronie infra (env var w CF Workers secret, nie commitować do repo)

---

## Konfiguracja w CF Workers (po otrzymaniu klucza)

```bash
# Secret w control plane (NIE w spoke):
wrangler secret put REGON_USER_KEY --env production
# wartość: klucz z maila GUS (20 znaków alfanumerycznych)
```

API endpoint produkcyjny:
- WSDL: `https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc`
- REST proxy: brak natywnego, wymagana implementacja SOAP client w `@mixturemarketing/web-core/src/regon/client.ts`

---

## Status

- [ ] **2026-05-18** — draft maila gotowy, czeka na dane firmy (NIP, REGON, adres) od Jakuba
- [ ] Mail wysłany
- [ ] Formularz otrzymany
- [ ] Formularz odesłany podpisany
- [ ] Klucz produkcyjny otrzymany
- [ ] Klucz wgrany do CF Workers secret
- [ ] Test E2E: NIP → autofetch firmy z REGON działa
