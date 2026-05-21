/**
 * Demo client config — Professional theme.
 * "Kancelaria Adwokacka Wiśniewski & Partnerzy — Wrocław".
 */

import { validateClientConfig, type ClientConfig } from "../src/client.config.schema.js";

const config: ClientConfig = {
  clientId: "clk_demo_professional",

  business: {
    name: "Kancelaria Adwokacka Wiśniewski & Partnerzy",
    legalName: "Wiśniewski Adwokaci Sp.p.",
    nip: "8961234567",
    krs: "0001234567",
    industry: "prawnik",
    schemaType: "ProfessionalService",
    foundedYear: 2012,
    employeeCount: 8,
    description:
      "Kancelaria adwokacka we Wrocławiu. Prawo gospodarcze, cywilne, pracy. Doradztwo prawne dla firm i osób prywatnych.",
    tagline: "Profesjonalna obsługa prawna od 2012 roku",
    longDescription:
      "Kancelaria Wiśniewski & Partnerzy działa we Wrocławiu od 2012 roku. Specjalizujemy się w prawie gospodarczym, cywilnym, rodzinnym i pracy. Reprezentujemy zarówno przedsiębiorców jak i klientów indywidualnych — przed sądami wszystkich instancji.",
  },

  contact: {
    primaryPhone: "+48717123456",
    email: "kancelaria@wisniewski-demo.pl",
    notificationEmail: "kancelaria@wisniewski-demo.pl",
    contactPersonName: "adw. Krzysztof Wiśniewski",
  },

  location: {
    address: {
      streetAddress: "ul. Świdnicka 38/12",
      city: "Wrocław",
      voivodeship: "dolnośląskie",
      postalCode: "50-068",
      country: "PL",
    },
    geo: { latitude: 51.1079, longitude: 17.0385 },
    serviceArea: ["Wrocław", "Oława", "Oleśnica", "Trzebnica", "Wołów"],
  },

  services: [
    { slug: "prawo-gospodarcze", name: "Prawo gospodarcze", description: "Obsługa prawna firm, kontrakty handlowe, spory między przedsiębiorcami.", priceFrom: "od 250 zł/h", iconKey: "briefcase" },
    { slug: "prawo-cywilne", name: "Prawo cywilne", description: "Sprawy o zapłatę, odszkodowania, spadkowe, nieruchomości.", priceFrom: "od 200 zł/h", iconKey: "briefcase" },
    { slug: "prawo-pracy", name: "Prawo pracy", description: "Reprezentacja pracowników i pracodawców, spory sądowe.", priceFrom: "od 200 zł/h", iconKey: "briefcase" },
    { slug: "prawo-rodzinne", name: "Prawo rodzinne", description: "Rozwody, podział majątku, alimenty, władza rodzicielska.", priceFrom: "od 200 zł/h", iconKey: "briefcase" },
    { slug: "windykacja", name: "Windykacja należności", description: "Sądowa i pozasądowa windykacja należności dla firm.", priceFrom: "stawka prowizyjna", iconKey: "briefcase" },
  ],

  hours: {
    monday: ["09:00", "17:00"],
    tuesday: ["09:00", "17:00"],
    wednesday: ["09:00", "17:00"],
    thursday: ["09:00", "17:00"],
    friday: ["09:00", "16:00"],
    saturday: "closed",
    sunday: "closed",
    note: "Spotkania poza godzinami pracy — po wcześniejszym umówieniu",
  },

  theme: {
    preset: "minimalist",
    variant: "mono-blue",
  },

  domain: { primary: "demo-professional.mixturemarketing.pl", canonicalScheme: "https" },

  integrations: { plausible: true, zaraz: false },

  reviews: [
    { author: "Spółka X.", rating: 5, date: "2026-04-05", text: "Rzetelna obsługa prawna naszej firmy od 3 lat. Adwokat Wiśniewski wygrał kluczowy spór z kontrahentem.", source: "gbp" },
    { author: "Marek L.", rating: 5, date: "2026-02-22", text: "Kompleksowa pomoc przy rozwodzie. Profesjonalizm, empatia, znajomość prawa.", source: "gbp" },
    { author: "Anna B.", rating: 5, date: "2026-01-30", text: "Pomoc w sprawie spadkowej — wszystko jasno wytłumaczone. Polecam.", source: "gbp" },
  ],

  rodo: { consentVersion: "v1.0", dpaSigned: true },
};

export default validateClientConfig(config);
