/**
 * Organization JSON-LD builder.
 *
 * Use when NOT a LocalBusiness (e.g. for our MixtureMarketing entity in agency mode,
 * or for klient's parent company if they have multiple locations).
 *
 * For klient business → use @mixturemarketing/web-core/local (LocalBusiness extends Organization).
 */

import type { ImageObjectInput, ImageObjectJsonLd } from "./types.js";
import { SCHEMA_CONTEXT } from "./types.js";

export interface ContactPointInput {
  /** "customer service" | "technical support" | "sales" — semantic role */
  contactType: string;
  telephone?: string;
  email?: string;
  /** Geographic area served, e.g. "PL". */
  areaServed?: string;
  /** Languages supported. */
  availableLanguage?: readonly string[];
}

export interface OrganizationInput {
  /** Canonical URL — used as @id. */
  url: string;
  /** Organization name. */
  name: string;
  /** Legal entity name if different. */
  legalName?: string;
  /** Logo (Knowledge Panel uses this — should be square, transparent PNG). */
  logo?: ImageObjectInput;
  /** Short tagline / slogan. */
  slogan?: string;
  /** Long description. */
  description?: string;
  /** Founded date (ISO YYYY or YYYY-MM-DD). */
  foundingDate?: string;
  /** sameAs URLs (social media + verified profiles). */
  sameAs?: readonly string[];
  /** Contact points (multiple if klient has multiple departments). */
  contactPoints?: readonly ContactPointInput[];
  /** Tax IDs (NIP for Poland). */
  taxID?: string;
  /** VAT ID (PL: NIP w formacie "PL1234567890"). */
  vatID?: string;
}

export interface ContactPointJsonLd {
  "@type": "ContactPoint";
  contactType: string;
  telephone?: string;
  email?: string;
  areaServed?: string;
  availableLanguage?: string[];
}

export interface OrganizationJsonLd {
  "@context": "https://schema.org";
  "@type": "Organization";
  "@id": string;
  url: string;
  name: string;
  legalName?: string;
  logo?: ImageObjectJsonLd;
  slogan?: string;
  description?: string;
  foundingDate?: string;
  sameAs?: string[];
  contactPoint?: ContactPointJsonLd[];
  taxID?: string;
  vatID?: string;
}

export function organizationSchema(input: OrganizationInput): OrganizationJsonLd {
  if (!input.name.trim()) throw new Error("organizationSchema: name required");

  const out: OrganizationJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": input.url,
    url: input.url,
    name: input.name,
  };

  if (input.legalName) out.legalName = input.legalName;
  if (input.logo) {
    const logo: ImageObjectJsonLd = { "@type": "ImageObject", url: input.logo.url };
    if (input.logo.width !== undefined) logo.width = input.logo.width;
    if (input.logo.height !== undefined) logo.height = input.logo.height;
    out.logo = logo;
  }
  if (input.slogan) out.slogan = input.slogan;
  if (input.description) out.description = input.description;
  if (input.foundingDate) out.foundingDate = input.foundingDate;
  if (input.sameAs?.length) out.sameAs = [...input.sameAs];
  if (input.taxID) out.taxID = input.taxID;
  if (input.vatID) out.vatID = input.vatID;
  if (input.contactPoints?.length) {
    out.contactPoint = input.contactPoints.map(buildContactPoint);
  }

  return out;
}

function buildContactPoint(input: ContactPointInput): ContactPointJsonLd {
  const out: ContactPointJsonLd = {
    "@type": "ContactPoint",
    contactType: input.contactType,
  };
  if (input.telephone) out.telephone = input.telephone;
  if (input.email) out.email = input.email;
  if (input.areaServed) out.areaServed = input.areaServed;
  if (input.availableLanguage?.length) out.availableLanguage = [...input.availableLanguage];
  return out;
}
