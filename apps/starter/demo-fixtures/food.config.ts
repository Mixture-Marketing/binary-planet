/**
 * Demo client config — Food theme.
 * "Trattoria Bocca — Kraków" (włoska restauracja + dostawa).
 */

import { validateClientConfig, type ClientConfig } from "../src/client.config.schema.js";

const config: ClientConfig = {
  clientId: "clk_demo_food",

  business: {
    name: "Trattoria Bocca",
    legalName: "Bocca Restaurant Sp. z o.o.",
    nip: "6791234567",
    industry: "restauracja",
    schemaType: "Restaurant",
    foundedYear: 2015,
    employeeCount: 12,
    description:
      "Włoska trattoria w sercu Krakowa. Domowa pasta, pizza z pieca opalanego drewnem, wina z południa Włoch.",
    tagline: "Smak Toskanii w Krakowie",
    longDescription:
      "Trattoria Bocca to rodzinne miejsce, w którym od 2015 roku gotujemy tak, jak w domach włoskich babć. Pasta robiona codziennie ręcznie, pizza z pieca opalanego drewnem dębowym, składniki bezpośrednio od włoskich dostawców.",
  },

  contact: {
    primaryPhone: "+48124567890",
    email: "rezerwacje@bocca-demo.pl",
    notificationEmail: "rezerwacje@bocca-demo.pl",
  },

  location: {
    address: {
      streetAddress: "ul. Floriańska 18",
      city: "Kraków",
      voivodeship: "małopolskie",
      postalCode: "31-019",
      country: "PL",
    },
    geo: { latitude: 50.0647, longitude: 19.9450 },
    serviceArea: ["Kraków Stare Miasto", "Kraków Kazimierz", "Kraków Podgórze"],
  },

  services: [
    { slug: "pasta", name: "Pasta domowa", description: "Spaghetti carbonara, tagliatelle al ragù, fettuccine alfredo — robione codziennie.", priceFrom: "od 38 zł", iconKey: "flame" },
    { slug: "pizza", name: "Pizza z pieca opalanego drewnem", description: "Margherita, prosciutto, capricciosa — neapolitańskie ciasto, 48h fermentacji.", priceFrom: "od 35 zł", iconKey: "flame" },
    { slug: "antipasti", name: "Antipasti i przystawki", description: "Bruschetty, carpaccio, deska serów i wędlin.", priceFrom: "od 28 zł", iconKey: "flame" },
    { slug: "wina", name: "Karta win", description: "60 win z południa Włoch — Toskania, Sycylia, Puglia.", priceFrom: "od 25 zł/kieliszek", iconKey: "flame" },
    { slug: "catering", name: "Catering eventowy", description: "Wesela, urodziny, eventy firmowe — pełna obsługa.", priceFrom: "wycena indywidualna", iconKey: "flame" },
  ],

  hours: {
    monday: ["12:00", "23:00"],
    tuesday: ["12:00", "23:00"],
    wednesday: ["12:00", "23:00"],
    thursday: ["12:00", "23:00"],
    friday: ["12:00", "23:59"],
    saturday: ["12:00", "23:59"],
    sunday: ["12:00", "22:00"],
    note: "Kuchnia czynna do 22:30 (pon-czw) i 23:30 (pt-sob)",
  },

  theme: {
    preset: "editorial",
    variant: "forest-amber",
  },

  domain: { primary: "demo-food.mixturemarketing.pl", canonicalScheme: "https" },

  integrations: { plausible: true, zaraz: false },

  reviews: [
    { author: "Michał K.", rating: 5, date: "2026-04-28", text: "Najlepsza carbonara w Krakowie. Klasyk bez śmietany, prawdziwy guanciale. Wino świetnie dobrane.", source: "gbp" },
    { author: "Olga R.", rating: 5, date: "2026-03-15", text: "Pizza margherita jak w Neapolu. Ciasto przepyszne, mozzarella di bufala top.", source: "gbp" },
    { author: "Tomasz S.", rating: 4, date: "2026-02-10", text: "Świetne jedzenie, czasem trzeba poczekać na stolik — warto zarezerwować.", source: "gbp" },
  ],

  rodo: { consentVersion: "v1.0", dpaSigned: false },
};

export default validateClientConfig(config);
