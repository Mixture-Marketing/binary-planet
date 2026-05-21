/**
 * Demo client config — Beauty theme.
 * "Salon Lila — Warszawa Mokotów" (fryzjer + paznokcie).
 *
 * Used to deploy demo-beauty.mixturemarketing.pl showcasing the Beauty theme preset.
 * To use: cp demo-fixtures/beauty.config.ts src/client.config.ts && pnpm build && wrangler deploy --name mm-demo-beauty
 */

import { validateClientConfig, type ClientConfig } from "../src/client.config.schema.js";

const config: ClientConfig = {
  clientId: "clk_demo_beauty",

  business: {
    name: "Salon Lila",
    legalName: "Lila Beauty Sp. z o.o.",
    nip: "1234567890",
    industry: "beauty",
    schemaType: "HairSalon",
    foundedYear: 2019,
    employeeCount: 5,
    description:
      "Salon fryzjersko-kosmetyczny w Warszawie. Strzyżenia, koloryzacja, manicure, pedicure — w atmosferze, do której chcesz wracać.",
    tagline: "Twoje miejsce na chwilę dla siebie",
    longDescription:
      "Salon Lila to butikowy salon na Mokotowie, gdzie łączymy klasyczne usługi fryzjerskie i kosmetyczne z indywidualnym podejściem. Nasz zespół 5 stylistek specjalizuje się w naturalnej koloryzacji, balayage, manicure hybrydowym i pedicure spa.",
  },

  contact: {
    primaryPhone: "+48221234567",
    email: "kontakt@salonlila-demo.pl",
    notificationEmail: "kontakt@salonlila-demo.pl",
  },

  location: {
    address: {
      streetAddress: "ul. Puławska 145",
      city: "Warszawa",
      voivodeship: "mazowieckie",
      postalCode: "02-715",
      country: "PL",
    },
    geo: { latitude: 52.1894, longitude: 21.0224 },
    serviceArea: ["Warszawa Mokotów", "Warszawa Ursynów", "Warszawa Wilanów"],
  },

  services: [
    { slug: "strzyzenie", name: "Strzyżenie damskie", description: "Strzyżenie damskie z modelowaniem.", priceFrom: "od 120 zł", iconKey: "star" },
    { slug: "koloryzacja", name: "Koloryzacja", description: "Pełna koloryzacja, balayage, refleksy.", priceFrom: "od 250 zł", iconKey: "star" },
    { slug: "manicure-hybrydowy", name: "Manicure hybrydowy", description: "Manicure hybrydowy z odżywką keratynową.", priceFrom: "od 90 zł", iconKey: "star" },
    { slug: "pedicure-spa", name: "Pedicure SPA", description: "Pedicure z peelingiem i maseczką.", priceFrom: "od 130 zł", iconKey: "star" },
    { slug: "zabiegi-na-twarz", name: "Zabiegi na twarz", description: "Oczyszczanie, hydratacja, mezoterapia.", priceFrom: "od 200 zł", iconKey: "star" },
  ],

  hours: {
    monday: ["10:00", "20:00"],
    tuesday: ["10:00", "20:00"],
    wednesday: ["10:00", "20:00"],
    thursday: ["10:00", "20:00"],
    friday: ["10:00", "20:00"],
    saturday: ["09:00", "16:00"],
    sunday: "closed",
  },

  theme: {
    preset: "elegant",
    variant: "rose-cream",
  },

  domain: { primary: "demo-beauty.mixturemarketing.pl", canonicalScheme: "https" },

  integrations: { plausible: true, zaraz: false },

  reviews: [
    { author: "Karolina W.", rating: 5, date: "2026-04-12", text: "Najlepszy balayage w Warszawie. Stylistka słucha co lubię i nigdy mnie nie zawiodła.", source: "gbp" },
    { author: "Agata M.", rating: 5, date: "2026-03-20", text: "Klimat, profesjonalizm, ceny adekwatne. Polecam pedicure SPA.", source: "gbp" },
    { author: "Justyna T.", rating: 5, date: "2026-02-15", text: "Manicure hybrydowy trzyma 3 tygodnie. Jakość materiałów top.", source: "gbp" },
  ],

  rodo: { consentVersion: "v1.0", dpaSigned: false },
};

export default validateClientConfig(config);
