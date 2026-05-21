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
    mode: "light",
  },

  domain: { primary: "demo-editorial.mixturemarketing.pl", canonicalScheme: "https" },

  integrations: { plausible: true, zaraz: false },

  reviews: [
    { author: "Michał K.", rating: 5, date: "2026-04-28", text: "Najlepsza carbonara w Krakowie. Klasyk bez śmietany, prawdziwy guanciale. Wino świetnie dobrane.", source: "gbp" },
    { author: "Olga R.", rating: 5, date: "2026-03-15", text: "Pizza margherita jak w Neapolu. Ciasto przepyszne, mozzarella di bufala top.", source: "gbp" },
    { author: "Tomasz S.", rating: 4, date: "2026-02-10", text: "Świetne jedzenie, czasem trzeba poczekać na stolik — warto zarezerwować.", source: "gbp" },
  ],

  rodo: { consentVersion: "v1.0", dpaSigned: false },

  sections: [
    {
      kind: "history",
      enabled: true,
      config: {
        heading: "Od babci Lucii do Krakowa",
        pullQuote: "Trattoria to nie restauracja. To zaproszenie do domu rodziny.",
        body: "Od kiedy pamiętam, kuchnia była sercem domu rodzinnego. Babcia Lucia uczyła mnie ręcznie wałkować ciasto przy stole z drewna jodłowego — to samo, które dziś stoi w naszej krakowskiej kuchni.\n\nZ 12 lat zacząłem służyć kolacje sąsiadom w wiosce Greve in Chianti. Z 22 lat otworzyłem pierwszą trattorię w Toskanii. W 2015 roku przeniosłem się do Krakowa — bo żona, bo miłość, bo Polska smakuje inaczej, ale gościnnie.\n\nTrattoria Bocca jest dziś rodzinną sprawą. Marco gotuje. Magda prowadzi salę. Antonio, nasz syn, w soboty pomaga przy pizzy.",
        authorByline: "Marco Bocca, szef kuchni",
        dropCap: true,
        ornament: "divider-fleuron",
      },
    },
    {
      kind: "gallery",
      enabled: true,
      config: {
        heading: "Z naszej kuchni",
        columns: 3,
        aspectRatio: "4:3",
        images: [
          { url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80", alt: "Pizza margherita", caption: "Margherita — neapolitańskie ciasto, 48h fermentacji" },
          { url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80", alt: "Carbonara", caption: "Carbonara klasyczna — bez śmietany" },
          { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", alt: "Wnętrze restauracji" },
          { url: "https://images.unsplash.com/photo-1576867757603-05b134ebc379?w=800&q=80", alt: "Antipasti deska" },
          { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80", alt: "Sala wieczorem" },
          { url: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=800&q=80", alt: "Tiramisu" },
        ],
      },
    },
    {
      kind: "menu",
      enabled: true,
      config: {
        heading: "Karta dań",
        categories: [
          {
            name: "Pasta",
            items: [
              { name: "Spaghetti Carbonara", description: "Guanciale, żółtko, Pecorino, pieprz", price: "42 zł", badge: "Polecane" },
              { name: "Tagliatelle al Ragù", description: "Sos mięsny gotowany 6 godzin", price: "46 zł" },
              { name: "Fettuccine Alfredo", description: "Parmigiano, masło, śmietana", price: "38 zł" },
            ],
          },
          {
            name: "Pizza",
            items: [
              { name: "Margherita DOP", description: "San Marzano, mozzarella di bufala, bazylia", price: "35 zł" },
              { name: "Prosciutto e Funghi", description: "Mozzarella, prosciutto cotto, pieczarki", price: "42 zł" },
              { name: "Diavola", description: "Salami pikantne, mozzarella, papryczki", price: "44 zł" },
            ],
          },
          {
            name: "Wina (kieliszek)",
            items: [
              { name: "Chianti Classico DOCG", description: "Toskania, Sangiovese", price: "28 zł" },
              { name: "Primitivo Puglia IGT", description: "Apulia, pełne i owocowe", price: "26 zł" },
              { name: "Prosecco DOC", description: "Wenecja, musujące", price: "24 zł" },
            ],
          },
        ],
      },
    },
  ],
};

export default validateClientConfig(config);
