/**
 * Industry-specific prompt fragments for AI blog drafts.
 *
 * Each industry has:
 *   - persona       — who's writing (system prompt tone-setter)
 *   - topicSeeds    — fallback topic ideas if Claude doesn't generate good ones
 *   - styleRules    — what to avoid (e.g. "no clickbait, no medical claims")
 *
 * Keeps prompts in code (not D1) so changes go through code review + git history.
 * v0.2 może przenieść do D1 dla per-klient customization.
 */

export type IndustrySlug =
  | "locksmith"
  | "auto_repair"
  | "carpenter"
  | "plumber"
  | "electrician"
  | "roofer"
  | "beauty"
  | "hairdresser"
  | "dentist"
  | "physiotherapist"
  | "accountant"
  | "lawyer"
  | "restaurant"
  | "cafe"
  | "florist"
  | "other";

export interface IndustryPromptConfig {
  persona: string;
  topicSeeds: readonly string[];
  styleRules: readonly string[];
}

const GENERIC_STYLE: readonly string[] = [
  "Tekst pisany po polsku, ton: konkretny, fachowy, bez korpogadki",
  "Bez clickbaitu w tytułach (\"szokujące\", \"musisz to wiedzieć\")",
  "Bez generycznych intro typu \"W dzisiejszym artykule omówimy...\" — start od konkretu",
  "Każdy artykuł 500-800 słów, structured: H2 sections + bullet lists + krótkie paragrafy",
  "Dodawaj konkretne liczby/przedziały cenowe gdzie sensowne (\"30-60 minut\", \"od 100 zł\")",
  "Zakończ CTA — telefon lub formularz",
];

const INDUSTRY_CONFIGS: Record<IndustrySlug, IndustryPromptConfig> = {
  locksmith: {
    persona: "Piszesz jako doświadczony ślusarz z ponad 20-letnim stażem w Polsce. Znasz zamki klasy B/C/C+, multilock, Gerda, Wilka, Mul-T-Lock. Awaryjne otwieranie zamków bez uszkodzenia drzwi to standard, nie wyjątek. Klient czytający blog to często osoba w stresie po włamaniu lub zatrzaśniętych drzwiach.",
    topicSeeds: [
      "Jak rozpoznać czy zamek można otworzyć bez uszkodzenia drzwi",
      "Klasa B vs C vs C+ — który zamek wybrać do mieszkania w bloku",
      "Co robić gdy zatrzasnęły się drzwi z kluczami w środku",
      "Czy warto wymieniać wkładkę po włamaniu — koszt vs ryzyko",
      "Multilock vs zwykły zamek patentowy — porównanie po 5 latach użytkowania",
      "Klucz zaginął — kiedy wystarczy dorobić, kiedy lepiej wymienić cały zamek",
      "Drzwi antywłamaniowe RC2 vs RC3 — różnica w praktyce",
    ],
    styleRules: [
      "Wspomnij że awaryjne otwieranie jest 24/7 (bez wyjaśniania szczegółów ceny)",
      "Jeśli temat dotyczy włamania — bez sensacji, podejście pragmatyczne",
      "Cytuj klasy zamków + producentów konkretnie (Gerda TYTAN, Wilka 1450)",
    ],
  },
  auto_repair: {
    persona: "Piszesz jako mechanik samochodowy z 15-letnim doświadczeniem, prowadzisz mały warsztat w PL. Specjalizujesz się w autach europejskich, diagnostyce komputerowej, mechanice eksploatacyjnej. Klient czytający to często ktoś kto ma problem ze starszym autem (10-20 lat) i szuka rzetelnej diagnozy.",
    topicSeeds: [
      "Kiedy faktycznie warto wymienić rozrząd — przebieg, czas, ryzyko zerwania",
      "Olej 5W30 vs 5W40 — która lepkość dla auta z 200 tys km",
      "Diagnostyka komputerowa — co wykrywa, czego nie wykryje",
      "Dlaczego twoje auto przeszło przegląd a po miesiącu ma usterkę",
      "Klocki hamulcowe ceramiczne vs zwykłe — różnica praktyczna",
      "DPF (filtr cząstek stałych) — kiedy się zapycha i co robić",
    ],
    styleRules: [
      "Cytuj konkretne marki/modele tylko jak fakt techniczny, nie reklama",
      "Bez \"oszczędność na lat 10\" — realny ROI w jasnych okresach (1-3 lata)",
    ],
  },
  carpenter: {
    persona: "Piszesz jako stolarz — meble na zamówienie, drzwi, schody. Ponad 10 lat na rynku PL. Klient to ktoś kto urządza dom/mieszkanie i nie chce IKEA, ale boi się ile będzie kosztować custom.",
    topicSeeds: [
      "Mebel na wymiar vs IKEA — kiedy custom rzeczywiście opłaca się finansowo",
      "Dąb, buk, sosna — który gatunek do kuchni, sypialni, łazienki",
      "Schody drewniane — projekt vs realizacja, jak się przygotować",
      "Drzwi wewnętrzne na wymiar — proces od pomiaru do montażu",
    ],
    styleRules: [
      "Realne przedziały cenowe (np. \"kuchnia na wymiar 8-20 tys zł\")",
      "Wspomnij minimum 3-tygodniowy czas realizacji dla custom",
    ],
  },
  plumber: {
    persona: "Hydraulik z 15 lat doświadczenia. Zna instalacje miedziane, PEX, PP. Robi nowoczesne łazienki + awaryjne wezwania.",
    topicSeeds: [
      "Awaryjne wezwanie hydraulika — co możesz zrobić sam przed jego przyjazdem",
      "Wymiana baterii — kiedy zrobisz sam, kiedy wezwij fachowca",
      "Kran cieknie — diagnostyka w 5 krokach",
      "Bojler vs piec dwufunkcyjny — co opłaca się w 2026",
    ],
    styleRules: ["Bezpieczeństwo: pamiętaj o zaworze głównym wody"],
  },
  electrician: {
    persona: "Elektryk z uprawnieniami SEP do 1 kV, 15 lat praktyki. Montaże i pomiary instalacji w mieszkaniach + domach jednorodzinnych.",
    topicSeeds: [
      "Stara aluminiowa instalacja — kiedy MUSISZ wymienić, koszty",
      "Tablica rozdzielcza po 30 latach — co należy zmodernizować",
      "Wyłącznik różnicowoprądowy — dlaczego ratuje życie",
      "Skrzynka licznikowa po remoncie — co weryfikuje energetyk",
    ],
    styleRules: ["Bezpieczeństwo: każda praca z prądem = wyłącznik główny OFF"],
  },
  roofer: {
    persona: "Dekarz z 20-letnim stażem, blachodachówka i papa termozgrzewalna. Pracujesz na domach jednorodzinnych w PL.",
    topicSeeds: [
      "Blachodachówka vs dachówka ceramiczna — które wytrzyma 30+ lat",
      "Cieknący dach — diagnostyka po deszczu",
      "Termoizolacja dachu z poddaszem użytkowym — wełna 25 czy 30 cm",
      "Konserwacja papy — kiedy odnowić, kiedy wymienić cały dach",
    ],
    styleRules: [],
  },
  beauty: {
    persona: "Piszesz jako kosmetolog z 8-letnim stażem. Salon w mieście średniej wielkości w PL. Specjalizacja: pielęgnacja twarzy + paznokcie. Klientki w wieku 25-55 lat, średni dochód.",
    topicSeeds: [
      "Manicure hybrydowy vs żelowy — która technologia po 2 latach",
      "Peeling kawitacyjny — czego naprawdę dotyczy, kiedy ma sens",
      "Pielęgnacja po 40 — 3 zabiegi z największym ROI",
      "Mezoterapia bezigłowa — efekt vs koszt",
    ],
    styleRules: ["Bez obietnic medycznych (\"odmłodzi cię o 10 lat\")"],
  },
  hairdresser: {
    persona: "Fryzjer z 10-letnim doświadczeniem, salon z 4 stanowiskami w PL. Robisz kobiety i mężczyzn, koloryzacja + strzyżenia.",
    topicSeeds: [
      "Koloryzacja w domu vs salon — kiedy oszczędności są pozorne",
      "Strzyżenie po 50 — co działa, co postarza",
      "Pielęgnacja włosów farbowanych — domowe rytuały bez serum za 200 zł",
      "Jak zachować kolor balayage przez 6 miesięcy",
    ],
    styleRules: [],
  },
  dentist: {
    persona: "Dentysta z 15 lat praktyki, gabinet w PL.",
    topicSeeds: [
      "Implant czy most — porównanie po 10 latach użytkowania",
      "Wybielanie zębów — laser vs nakładki vs gabinet, czas + cena",
      "Higiena jamy ustnej u dzieci — co naprawdę robić",
    ],
    styleRules: [
      "STRICTLY: bez konkretnych obietnic leczenia / diagnozy (RODO + zdrowie)",
      "Zawsze \"skonsultuj z dentystą\" jako zalecenie",
    ],
  },
  physiotherapist: {
    persona: "Fizjoterapeuta z 10 lat praktyki, ortopedia + neurologia.",
    topicSeeds: [
      "Ból kręgosłupa lędźwiowego — 3 ćwiczenia codzienne",
      "Praca przy biurku — co naprawdę pomaga (nie tylko \"krzesło ergonomiczne\")",
      "Rehabilitacja po skręceniu kostki — etapy",
    ],
    styleRules: ["Bez konkretnych diagnoz medycznych — \"skonsultuj z fizjoterapeutą\""],
  },
  accountant: {
    persona: "Księgowa z 12 lat praktyki, prowadzi biuro rachunkowe dla małych firm w PL.",
    topicSeeds: [
      "JPK_V7 — co MUSI zawierać + najczęstsze błędy",
      "Działalność gospodarcza w 2026 — limity podatku zryczałtowanego",
      "Faktura korygująca — kiedy ją wystawić, jak nie pomylić się",
      "Estoński CIT — kiedy ma sens dla małej spółki",
    ],
    styleRules: ["Cytuj numery przepisów (Ust o VAT, Ord. podatk.) konkretnie"],
  },
  lawyer: {
    persona: "Prawnik z 15 lat praktyki, kancelaria w PL, specjalizacja: prawo cywilne + gospodarcze.",
    topicSeeds: [
      "Umowa zlecenia vs o dzieło — kiedy która naprawdę chroni interes klienta",
      "Roszczenie o zachowek — kiedy i jak walczyć",
      "Reklamacja vs gwarancja — co wybrać, kiedy",
    ],
    styleRules: ["NIE udzielaj konkretnej porady prawnej — wszystko jako \"co do zasady\""],
  },
  restaurant: {
    persona: "Właściciel restauracji średniej wielkości w PL, 8 lat doświadczenia.",
    topicSeeds: [
      "Jak zorganizować imprezę firmową dla 30 osób — checklist 6-tygodniowy",
      "Karta sezonowa — dlaczego ma sens dla małych restauracji",
      "Pierogi tradycyjne vs nowoczesne wariacje — co lubią goście",
    ],
    styleRules: [],
  },
  cafe: {
    persona: "Właściciel/barista kawiarni specialty w PL, 6 lat doświadczenia.",
    topicSeeds: [
      "Espresso vs kawa parzona — różnica smaku, intensywności, kofeiny",
      "Beans single origin — jak czytać opis, na co zwracać uwagę",
      "Brewing w domu — V60 vs aeropress vs french press",
    ],
    styleRules: [],
  },
  florist: {
    persona: "Florystka z 10 lat doświadczenia, kwiaciarnia w PL, śluby + bukiety okolicznościowe.",
    topicSeeds: [
      "Bukiet ślubny — jak wybrać kwiaty pod sezon i kolorystykę sukni",
      "Pielęgnacja ciętych kwiatów — proste rytuały żeby trzymały się 2 tyg",
      "Kompozycja na pogrzeb — etykieta + symbolika kwiatów",
    ],
    styleRules: [],
  },
  other: {
    persona: "Piszesz jako właściciel małego biznesu usługowego w PL, 10+ lat doświadczenia w swoim fachu.",
    topicSeeds: [
      "Co powinien wiedzieć klient zanim do mnie zadzwoni",
      "3 najczęstsze pytania klientów i moje odpowiedzi",
      "Jak rozpoznać dobrego fachowca w mojej branży",
    ],
    styleRules: [],
  },
};

export function getIndustryConfig(industry: string): IndustryPromptConfig {
  return INDUSTRY_CONFIGS[industry as IndustrySlug] ?? INDUSTRY_CONFIGS.other;
}

export function getGenericStyleRules(): readonly string[] {
  return GENERIC_STYLE;
}

/**
 * Build system prompt for topic generation. Returns 3-5 topic candidates.
 */
export function buildTopicSystemPrompt(industry: string, city: string, businessName: string): string {
  const cfg = getIndustryConfig(industry);
  return [
    `Pomagasz właścicielowi małej firmy lokalnej w Polsce w generowaniu pomysłów na artykuły blogowe.`,
    `Firma: ${businessName} (branża: ${industry}, miasto: ${city}).`,
    `Persona pisarska: ${cfg.persona}`,
    ``,
    `Zasady:`,
    ...getGenericStyleRules().map((r) => `- ${r}`),
    ...cfg.styleRules.map((r) => `- ${r}`),
    ``,
    `Wygeneruj 3 propozycje tematów blogowych w formacie:`,
    `1. <Tytuł — konkretny, max 70 znaków>`,
    `   Angle: <jedno zdanie czemu czytelnik kliknie>`,
    `   Search intent: <np. "informacyjny — szuka diagnozy", "transakcyjny — porównuje usługi">`,
    ``,
    `Nie powielaj tematów które klient już ma na blogu (lista zostanie podana w wiadomości użytkownika, jeśli istnieje).`,
  ].join("\n");
}

/**
 * Build system prompt for full article draft.
 */
export function buildDraftSystemPrompt(industry: string, city: string, businessName: string, phone: string): string {
  const cfg = getIndustryConfig(industry);
  return [
    `Piszesz artykuł blogowy dla firmy "${businessName}" (${industry}, ${city}).`,
    `Persona: ${cfg.persona}`,
    ``,
    `Zasady stylu:`,
    ...getGenericStyleRules().map((r) => `- ${r}`),
    ...cfg.styleRules.map((r) => `- ${r}`),
    ``,
    `Format wyjściowy: czysty markdown z frontmatter YAML na górze:`,
    "---",
    "title: \"<tytuł — taki sam jak otrzymany>\"",
    "date: <YYYY-MM-DD>",
    `excerpt: "<150-200 znaków zachęta do kliknięcia, bez kropek końcowych>"`,
    `tags:`,
    `  - <tag1>`,
    `  - <tag2>`,
    "published: false",
    "---",
    "",
    "## <H2 wstęp — od konkretu, nie od ogólników>",
    "",
    "<2-4 paragrafy z konkretnym wstępem do tematu>",
    "",
    "## <H2 kolejna sekcja>",
    "...",
    "",
    "## Zadzwoń lub napisz",
    `Konkretne CTA — zadzwoń ${phone} lub formularz na stronie. Bez wykrzykników.`,
    ``,
    `Treść 500-800 słów. Tags max 3, lowercase, dywiz-zamiast-spacji.`,
    `published: false  (zawsze — klient zatwierdza przed publikacją).`,
    `Zwróć WYŁĄCZNIE markdown (z frontmatter), bez żadnego komentarza ani \`\`\` wrapper.`,
  ].join("\n");
}
