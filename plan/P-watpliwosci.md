# APPENDIX P — Wątpliwości i otwarte pytania

## P.1 Moje główne wątpliwości do planu

**1. Skalowalność solo do 250+ klientów**
Plan zakłada 125-140h/mc twojej pracy przy 250 klientach. To jest 50h/tydz, czyli pełen etat + nadgodziny. Bez outsource'owania (VA, junior) nie zatrzymasz wzrostu. Pomyśl o **rezerwie 30%** na sprzedaż/marketing/customer success, nie tylko operacje.

**2. Akwizycja kanałów — niezweryfikowane**
Plan zakłada że klienci będą "się znajdować". W rzeczywistości akwizycja mikrofirm w PL jest **trudna i droga**. CAC (Customer Acquisition Cost) może być 300-500 zł per klient, co przy LTV 1188 zł (Starter 12 mc) daje 2.5x LTV/CAC — akceptowalne ale na granicy.

Rekomendacja: **wykonaj test sprzedaży PRZED budową technicznej** (faza -1):
- Spróbuj sprzedać 5 klientom usługę "fake" (ręcznie tworzona strona) za 149 zł/mc
- Jeśli sprzedasz w 30 dni → market validation OK, buduj automat
- Jeśli nie → problem nie jest techniczny, jest sprzedażowy. Rozwiąż najpierw

**3. RODO compliance complexity**
DPA, IODO, cookie consent, audit log, retencja danych — to nie jest tygodniowa praca. **Konsultacja prawnika 2-3k zł** to minimum, ale realistic to 5-10k zł na pełen compliance assessment + miesięczne retainer 500-1000 zł dla kwartalnych review.

**4. Konkurencja od WordPress agencji**
Lokalne agencje WordPress oferują strony klienta za 1500-3000 zł setup + 100 zł/mc hosting. Ich value prop: znamy klienta, jesteśmy pod ręką, możemy wszystko zmienić. Twoje value prop: szybkość, jakość, SEO. **Communicate clearly w marketing**.

**5. Czy theme presets wystarczą?**
6 presetów × 5 wariantów = 30 kombinacji. Ale klient może chcieć "to ale z pomarańczowym akcentem i większymi czcionkami". Brak custom design = czasem deal-breaker. Rozważ: **paid theme customization** ($199-499 one-time, brand designer freelancer).

**6. AI quality dla polskiego copywritingu**
Claude jest bardzo dobry po polsku, ale local nuances (gwara, specyfika branżowa) wymagają fine-tuningu promptów. **Plan iteracji promptów** w fazie 4 (na pierwszych klientach) jest krytyczny. Bez tego output AI będzie generyczny i klient się rozczaruje.

**7. GitHub Packages dla prywatnej npm**
W planie założyłem GitHub Packages. Działa ale ma quirks (auth do install, nie zawsze gładko z monorepo). Alternatywa: **prywatne npm registry własne (Verdaccio na CF Worker)** lub commercial (npm Enterprise). Decyzję podejmij wczesnie, migracja boli.

**8. Multi-environment (prod/staging/dev)**
Plan zakłada bezpośredni deploy na prod. Ale każda strona klienta powinna mieć staging. Co najmniej `client-id-staging.binary-planet.pl` przed promocją na prod domain. To dodaje complexity ale ratuje skin przy bug w production.

## P.2 Otwarte pytania do dyskusji

1. **Nazwa produktu** — "binary-planet" jest placeholderem. Krótsza, łatwiejsza wymowa PL/EN, .pl + .com available?

2. **Test sprzedaży przed budową** — czy chcesz zrobić pilotowy test akwizycji (5 klientów ręcznie) przed zaczęciem techniki? To może odroczyć start o 4-6 tygodni ale walidować market.

3. **Outsource od początku** — czy startujesz solo czy z VA / juniorem od miesiąca 3-4? Wpływa na pricing i operacyjne procesy.

4. **Marketing budget** — przy CAC 300-500 zł i targetowanym 5-10 klientów/mc w pierwszych 6 mc → potrzeba ~3-5k zł/mc marketing budget. To jest istotny koszt w pierwszych 12 mc.

5. **Time-to-market vs perfekcja** — czy MVP z 3 theme presetami i Starter tier only w 6 tygodni, czy pełen plan z 6 presetami i 3 tier w 4 mc?

6. **Affiliate / white-label** — czy włączasz w MVP czy odsuwasz do v2? Może być game-changer dla akwizycji ale dodaje 2-3 tyg pracy.

7. **Branża startowa fokus** — czy startujesz "wszystkie 5 presetów" naraz, czy fokusujesz najpierw na 1 branży (np. ślusarze/mechanicy w 1 mieście) dla domain expertise?

---
