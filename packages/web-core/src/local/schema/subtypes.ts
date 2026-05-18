/**
 * Subtype-specific guidance: required + recommended fields per LocalBusiness subtype,
 * plus theme preset mapping (B-themes.md).
 *
 * Use {@link getSubtypeMeta} to drive UI hints in onboarding wizard and content prompts.
 */

import type { LocalBusinessSubtype } from "./types.js";

export type ThemePreset =
  | "craftsman"
  | "professional"
  | "medical"
  | "beauty"
  | "food"
  | "local-services"
  | "generic";

export interface SubtypeMeta {
  /** schema.org @type value. */
  type: LocalBusinessSubtype;
  /** Theme preset this subtype belongs to (drives starter template choice). */
  themePreset: ThemePreset;
  /** Human-friendly PL label (used in admin / wizard UI). */
  labelPl: string;
  /** Optional EN label. */
  labelEn: string;
  /**
   * Fields strongly recommended ABOVE the LocalBusiness baseline.
   * Builder doesn't enforce; this is editorial guidance.
   */
  recommendedFields: readonly (keyof import("./types.js").LocalBusinessInputBase)[];
  /**
   * Subtype-specific extension fields likely to be useful.
   * Builder includes whatever input supplies; this hints what to ask in wizard.
   */
  extensionFields: readonly (keyof import("./types.js").SubtypeSpecificInput)[];
}

const META: Readonly<Record<LocalBusinessSubtype, SubtypeMeta>> = {
  LocalBusiness: {
    type: "LocalBusiness",
    themePreset: "generic",
    labelPl: "Firma lokalna",
    labelEn: "Local business",
    recommendedFields: ["telephone", "address", "openingHoursSpecification", "geo"],
    extensionFields: [],
  },

  // --- craftsman -----------------------------------------------------------
  Locksmith: {
    type: "Locksmith",
    themePreset: "craftsman",
    labelPl: "Ślusarz",
    labelEn: "Locksmith",
    recommendedFields: ["telephone", "areaServed", "priceRange", "openingHoursSpecification"],
    extensionFields: [],
  },
  AutoRepair: {
    type: "AutoRepair",
    themePreset: "craftsman",
    labelPl: "Mechanik samochodowy / Warsztat",
    labelEn: "Auto repair",
    recommendedFields: ["telephone", "openingHoursSpecification", "geo", "priceRange"],
    extensionFields: ["brand"],
  },
  Plumber: {
    type: "Plumber",
    themePreset: "craftsman",
    labelPl: "Hydraulik",
    labelEn: "Plumber",
    recommendedFields: ["telephone", "areaServed", "priceRange"],
    extensionFields: [],
  },
  Electrician: {
    type: "Electrician",
    themePreset: "craftsman",
    labelPl: "Elektryk",
    labelEn: "Electrician",
    recommendedFields: ["telephone", "areaServed", "priceRange"],
    extensionFields: [],
  },

  // --- professional --------------------------------------------------------
  AccountingService: {
    type: "AccountingService",
    themePreset: "professional",
    labelPl: "Biuro rachunkowe",
    labelEn: "Accounting service",
    recommendedFields: [
      "telephone",
      "email",
      "openingHoursSpecification",
      "makesOffer",
      "aggregateRating",
    ],
    extensionFields: ["hasCredential"],
  },
  Notary: {
    type: "Notary",
    themePreset: "professional",
    labelPl: "Notariusz",
    labelEn: "Notary",
    recommendedFields: ["telephone", "email", "openingHoursSpecification", "aggregateRating"],
    extensionFields: ["hasCredential"],
  },
  Architect: {
    type: "Architect",
    themePreset: "professional",
    labelPl: "Architekt",
    labelEn: "Architect",
    recommendedFields: ["telephone", "email", "image", "sameAs"],
    extensionFields: ["hasCredential"],
  },
  RealEstateAgent: {
    type: "RealEstateAgent",
    themePreset: "professional",
    labelPl: "Pośrednik nieruchomości",
    labelEn: "Real estate agent",
    recommendedFields: ["telephone", "email", "areaServed", "image", "sameAs"],
    extensionFields: ["hasCredential"],
  },
  ProfessionalService: {
    type: "ProfessionalService",
    themePreset: "professional",
    labelPl: "Usługi profesjonalne",
    labelEn: "Professional service",
    recommendedFields: ["telephone", "email", "openingHoursSpecification"],
    extensionFields: ["hasCredential"],
  },

  // --- medical -------------------------------------------------------------
  MedicalBusiness: {
    type: "MedicalBusiness",
    themePreset: "medical",
    labelPl: "Gabinet medyczny / Klinika",
    labelEn: "Medical business",
    recommendedFields: [
      "telephone",
      "email",
      "openingHoursSpecification",
      "aggregateRating",
      "image",
    ],
    extensionFields: ["medicalSpecialty", "hasCredential"],
  },

  // --- beauty --------------------------------------------------------------
  BeautySalon: {
    type: "BeautySalon",
    themePreset: "beauty",
    labelPl: "Salon urody",
    labelEn: "Beauty salon",
    recommendedFields: [
      "telephone",
      "image",
      "openingHoursSpecification",
      "aggregateRating",
      "makesOffer",
      "paymentAccepted",
    ],
    extensionFields: [],
  },
  HairSalon: {
    type: "HairSalon",
    themePreset: "beauty",
    labelPl: "Salon fryzjerski",
    labelEn: "Hair salon",
    recommendedFields: [
      "telephone",
      "image",
      "openingHoursSpecification",
      "aggregateRating",
      "makesOffer",
    ],
    extensionFields: [],
  },

  // --- food ----------------------------------------------------------------
  Restaurant: {
    type: "Restaurant",
    themePreset: "food",
    labelPl: "Restauracja",
    labelEn: "Restaurant",
    recommendedFields: [
      "telephone",
      "image",
      "openingHoursSpecification",
      "priceRange",
      "aggregateRating",
    ],
    extensionFields: ["servesCuisine", "menu", "acceptsReservations"],
  },

  // --- local-services ------------------------------------------------------
  MovingCompany: {
    type: "MovingCompany",
    themePreset: "local-services",
    labelPl: "Firma przeprowadzkowa",
    labelEn: "Moving company",
    recommendedFields: ["telephone", "areaServed", "priceRange", "makesOffer"],
    extensionFields: [],
  },
  ChildCare: {
    type: "ChildCare",
    themePreset: "local-services",
    labelPl: "Opieka nad dziećmi / Żłobek / Przedszkole",
    labelEn: "Child care",
    recommendedFields: ["telephone", "image", "openingHoursSpecification", "aggregateRating"],
    extensionFields: ["hasCredential"],
  },
};

export function getSubtypeMeta(type: LocalBusinessSubtype): SubtypeMeta {
  return META[type];
}

/** Returns all subtypes belonging to a theme preset. */
export function getSubtypesForPreset(preset: ThemePreset): SubtypeMeta[] {
  return Object.values(META).filter((m) => m.themePreset === preset);
}

/** Returns the theme preset for a given subtype (or "generic" fallback). */
export function presetForSubtype(type: LocalBusinessSubtype): ThemePreset {
  return META[type].themePreset;
}
