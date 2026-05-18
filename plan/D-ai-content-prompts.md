# APPENDIX D — AI Content Prompts (per branża, per sekcja)

Każdy theme preset ma plik `themes/[preset]/copy-templates/` z promptami dla 4 sekcji: hero, about, service-description, faq. Wszystkie używają Claude Sonnet 4.6 (fast + tani) z structured output (JSON).

## D.1 Wspólne zasady promptingu

Każdy prompt zawiera:
- **System prompt**: identyfikuje Claude'a jako specjalistę polskiego copywritingu B2C dla małych lokalnych firm
- **Context injection**: `{businessName}`, `{industry}`, `{city}`, `{serviceArea}`, `{usp}`, `{ownerName}`, `{yearsOfExperience}` (z REGON autofetch + wizard inputs)
- **Constraints**:
  - Polski naturalny, prosty język (poziom B1, max 20 słów na zdanie)
  - Zero żargonu marketingowego ("rewolucyjne rozwiązanie", "innowacyjne podejście")
  - Konkretne liczby, miasta, dzielnice
  - Min 1 lokalny anchor per akapit (nazwa miasta/dzielnicy)
  - NIE wymyślać faktów których nie ma w inputach (no hallucination)
- **Output format**: JSON z polami zdefiniowanymi per sekcja
- **EEAT signal injection**: każdy fragment dotyczący autora używa `{ownerName}` + `{yearsOfExperience}`

## D.2 Przykład: `craftsman` / hero

```
SYSTEM: Jesteś polskim copywriterem specjalizującym się w mikrofirmach rzemieślniczych.
Twoje teksty są krótkie, konkretne, pełne lokalnych nazw, bez żargonu.

USER:
Stwórz hero section dla strony rzemieślnika:
- Firma: {businessName}
- Branża: {industry} (np. ślusarstwo)
- Miasto: {city}
- Strefa: {serviceArea} (np. "Rzeszów + 30 km")
- Właściciel: {ownerName}
- Lat doświadczenia: {yearsOfExperience}
- USP: {usp}
- Główne usługi: {services}

Wygeneruj JSON:
{
  "headline": "Max 8 słów. Konkretna usługa + miasto. Bez 'profesjonalnie' itp.",
  "subheadline": "1-2 zdania. Co konkretnie oferujesz, dla kogo, gdzie. Akcent na dostępność/szybkość.",
  "primaryCTA": "Max 3 słowa. Akcja (np. 'Zadzwoń teraz', 'Sprawdź cennik').",
  "secondaryCTA": "Max 3 słowa. Alternatywa (np. 'Wyślij SMS', 'Wycena online').",
  "trustSignals": ["3 krótkie sygnały zaufania: liczba realizacji, lat doświadczenia, certyfikat, ubezpieczenie OC, gwarancja"]
}

Przykład dobrego output dla ślusarza:
{
  "headline": "Ślusarz Rzeszów — otwieranie zamków 24/7",
  "subheadline": "Awaryjne otwarcie drzwi, wymiana zamków, dorabianie kluczy. Dojazd w 30 minut na terenie Rzeszowa i okolic.",
  "primaryCTA": "Zadzwoń teraz",
  "secondaryCTA": "Wyślij SMS",
  "trustSignals": ["15 lat doświadczenia", "Ponad 3000 realizacji", "Ubezpieczenie OC do 100 000 zł"]
}
```

## D.3 Przykład: `professional` / about

```
SYSTEM: Jesteś polskim copywriterem dla kancelarii prawnych / biur księgowych / pracowni architektonicznych.
Twój styl: autorytatywny, precyzyjny, wzbudza zaufanie. Używasz pełnych imion i tytułów.

USER:
Stwórz sekcję "O kancelarii/biurze" dla:
- Firma: {businessName}
- Specjalizacja: {industry}
- Miasto: {city}
- Założyciel: {ownerName}, {credentials} (np. "radca prawny, OIRP w Rzeszowie")
- Lat doświadczenia: {yearsOfExperience}
- USP: {usp}
- Typowi klienci: {clientTypes}

Wygeneruj JSON:
{
  "headline": "Max 6 słów. Konkretna obietnica.",
  "introParagraph": "2-3 zdania. Kim jesteście, dla kogo pracujecie, gdzie.",
  "experienceParagraph": "2-3 zdania. Konkretne specjalizacje + lat doświadczenia + typowe sprawy.",
  "approachParagraph": "2-3 zdania. Jak pracujecie, czym się wyróżniacie (USP).",
  "authorByline": {
    "name": "{ownerName}",
    "title": "tytuł zawodowy z credentials",
    "highlight": "1 zdanie ekspertyzy"
  }
}
```

## D.4 Przykład: `medical` / service-description

```
SYSTEM: Jesteś polskim copywriterem treści medycznych dla małych gabinetów.
Stosujesz zasady YMYL: precyzyjny język, zero przesady, disclaimery, zachęta do konsultacji.

USER:
Stwórz opis usługi medycznej:
- Usługa: {serviceName}
- Specjalista: {specialistName}, {medicalSpecialty}
- Miasto: {city}
- Krótki opis usługi (od klienta): {serviceShortDescription}
- Cena orientacyjna: {priceFrom} zł

Wygeneruj JSON:
{
  "headline": "Nazwa usługi + miasto, max 8 słów",
  "introParagraph": "2-3 zdania: co to jest, kiedy się wykonuje. Bez sensacjonalizmu.",
  "procedureParagraph": "3-4 zdania: jak przebiega wizyta/zabieg.",
  "indicationsList": ["4-6 punktów: kiedy warto się zgłosić"],
  "contraindicationsList": ["3-5 punktów: kiedy NIE wykonujemy"],
  "afterCare": "1-2 zdania: zalecenia po zabiegu/wizycie",
  "disclaimer": "Standardowy disclaimer: opis nie zastępuje konsultacji lekarskiej.",
  "ctaText": "Konkretna akcja (umów wizytę, zapytaj o termin)"
}
```

## D.5 FAQ generator (dla wszystkich presetów, lokalny anchor)

```
SYSTEM: Generujesz pytania i odpowiedzi FAQ dla strony lokalnej firmy.
KAŻDA odpowiedź zawiera lokalny anchor (miasto, dzielnica). Odpowiedzi 30-80 słów.

USER:
Wygeneruj 8 pytań FAQ dla:
- Firma: {businessName}
- Branża: {industry}
- Miasto: {city}
- Strefa: {serviceArea}
- Usługi: {services}

Pytania muszą obejmować:
1. Zasięg geograficzny ("Czy obsługujecie [dzielnica]?")
2. Czas reakcji/dostępność
3. Cennik / wycena
4. Procedura zamówienia
5. Płatności (gotówka, BLIK, faktura)
6. Gwarancja/jakość
7. Pierwsza wizyta/spotkanie
8. Konkretna usługa najpopularniejsza

Wygeneruj JSON jako array obiektów {question, answer}.
```

## D.6 Programmatic page generator (service × dzielnica)

```
SYSTEM: Generujesz unikatową stronę landingową dla kombinacji USŁUGA × DZIELNICA.
Każda strona musi być inna od pozostałych w obrębie tej samej witryny.
500+ słów, lokalne anchory, lokalne dane (landmarks, kody pocztowe, charakterystyka dzielnicy).

USER:
Stwórz unikatową stronę "{serviceName} {locationName}":
- Firma: {businessName}
- Usługa: {serviceName} (pełny opis: {serviceFullDescription})
- Dzielnica/miasto: {locationName}
- Lokalne dane (z OSM): {locationLandmarks}, kod pocztowy {locationPostcode}, typ obszaru {locationType}
- Testimonial przypisany do tej lokalizacji: {localTestimonial}
- Inne strony już stworzone (DO NOT DUPLICATE): {existingPagesSummary}

Wygeneruj JSON:
{
  "h1": "Naturalna fraza, max 10 słów",
  "metaTitle": "55-60 znaków",
  "metaDescription": "140-160 znaków",
  "introSection": "150-200 słów, lokalne anchory min 2",
  "serviceDetailsSection": "200-250 słów, konkretne aspekty usługi RELEVANT dla tej dzielnicy/typu obszaru",
  "localContextSection": "150-200 słów, dlaczego ta dzielnica/lokalizacja ma swoje specyfiki, jak na to odpowiadacie",
  "faqs": [3 unikalne pytania-odpowiedzi dot. tej kombinacji],
  "ctaText": "Konkretne wezwanie do akcji"
}

WAŻNE: Tekst MUSI być unikalny vs {existingPagesSummary}. NIE używaj tych samych zwrotów otwierających. NIE wymyślaj danych których nie ma.
```

**Audit script w CI** (`content-quality.yml` workflow):
- Tokenize wszystkie programmatic pages
- Cosine similarity matrix
- FAIL jeśli jakakolwiek para ma >70% similarity
- FAIL jeśli word count <500
- FAIL jeśli brak struktury JSON-LD Service schema

---
