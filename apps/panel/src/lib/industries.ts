/** Shared industry catalog (mirror of mm-admin/src/lib/onboarding.ts INDUSTRIES). */

export const INDUSTRIES = [
  { slug: "locksmith", label: "Ślusarz", schemaType: "Locksmith" },
  { slug: "auto_repair", label: "Mechanik / warsztat", schemaType: "AutoRepair" },
  { slug: "carpenter", label: "Stolarz", schemaType: "GeneralContractor" },
  { slug: "plumber", label: "Hydraulik", schemaType: "Plumber" },
  { slug: "electrician", label: "Elektryk", schemaType: "Electrician" },
  { slug: "roofer", label: "Dekarz", schemaType: "RoofingContractor" },
  { slug: "beauty", label: "Salon kosmetyczny", schemaType: "BeautySalon" },
  { slug: "hairdresser", label: "Fryzjer", schemaType: "HairSalon" },
  { slug: "dentist", label: "Dentysta", schemaType: "Dentist" },
  { slug: "physiotherapist", label: "Fizjoterapeuta", schemaType: "Physician" },
  { slug: "accountant", label: "Biuro rachunkowe", schemaType: "AccountingService" },
  { slug: "lawyer", label: "Kancelaria prawna", schemaType: "LegalService" },
  { slug: "restaurant", label: "Restauracja", schemaType: "Restaurant" },
  { slug: "cafe", label: "Kawiarnia", schemaType: "CafeOrCoffeeShop" },
  { slug: "florist", label: "Kwiaciarnia", schemaType: "Florist" },
  { slug: "other", label: "Inna usługa lokalna", schemaType: "LocalBusiness" },
] as const;

export const POLISH_VOIVODESHIPS = [
  "dolnośląskie", "kujawsko-pomorskie", "lubelskie", "lubuskie", "łódzkie",
  "małopolskie", "mazowieckie", "opolskie", "podkarpackie", "podlaskie",
  "pomorskie", "śląskie", "świętokrzyskie", "warmińsko-mazurskie",
  "wielkopolskie", "zachodniopomorskie",
] as const;
