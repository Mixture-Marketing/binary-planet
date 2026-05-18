/**
 * RODO consent text — versioned templates rendered into the form + recorded with lead.
 *
 * Why versioned: if we change the text (e.g. add new sub-procesor), we need re-consent
 * for new submissions. Existing leads keep their original version (audit trail).
 *
 * Each template returns:
 *   - text: rendered HTML or markdown (form embeds this)
 *   - hash: sha256 of canonical form — stored with lead as evidence
 *
 * To add new version: append to TEMPLATES, bump latest. Old versions stay valid forever
 * (legal proof of consent at time of collection).
 */

import { sha256Hex } from "./pii.js";

export interface ConsentTemplateInput {
  businessName: string;
  primaryDomain: string;
  controllerName?: string; // legal name of MixtureMarketing entity
  /** Whether marketing checkbox is shown alongside processing. */
  showMarketing: boolean;
}

export interface ConsentTextOutput {
  /** Required processing consent (Art. 6.1.a or 6.1.b). */
  processingHtml: string;
  /** Optional marketing consent (always opt-in, separate checkbox). */
  marketingHtml?: string;
  /** Full canonical text used for hashing — concatenated. */
  canonical: string;
  /** sha256 of canonical, hex. */
  hash: string;
  /** Version identifier — store with lead. */
  version: string;
}

export const CURRENT_CONSENT_VERSION = "v1.0" as const;

type ConsentTemplateFn = (input: ConsentTemplateInput) => Promise<ConsentTextOutput>;

/**
 * v1.0 — initial baseline.
 * Pre-lawyer-review version: should be replaced before first prod klient.
 * Lawyer deliverable: see legal-questions.md C2 (DPA + RODO klauzule informacyjne).
 */
const v1_0: ConsentTemplateFn = async (input) => {
  const controller = input.controllerName ?? "MixtureMarketing";

  const processingText = `Przyjmuję do wiadomości, że administratorem moich danych jest ${input.businessName} (strona ${input.primaryDomain}). Dane przekazane w formularzu (imię, adres e-mail, numer telefonu, treść wiadomości) będą przetwarzane wyłącznie w celu odpowiedzi na zapytanie. Podmiotem przetwarzającym dane w imieniu administratora jest ${controller} (operator strony). Mam prawo dostępu do moich danych, ich sprostowania, usunięcia oraz wniesienia skargi do Prezesa UODO. Pełna polityka prywatności: https://${input.primaryDomain}/polityka-prywatnosci.`;

  const marketingText = input.showMarketing
    ? `Wyrażam zgodę na otrzymywanie informacji marketingowych (oferty, promocje) drogą elektroniczną od ${input.businessName} zgodnie z art. 10 ust. 2 ustawy o świadczeniu usług drogą elektroniczną. Mogę cofnąć zgodę w każdej chwili klikając "anuluj subskrypcję" w mailu.`
    : undefined;

  const canonical = [
    `v1.0`,
    `bn:${input.businessName}`,
    `dom:${input.primaryDomain}`,
    `ctrl:${controller}`,
    `proc:${processingText}`,
    marketingText ? `mkt:${marketingText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const hash = await sha256Hex(canonical);

  const wrap = (text: string): string =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const processingHtml = `<p>${wrap(processingText)}</p>`;
  const marketingHtml = marketingText ? `<p>${wrap(marketingText)}</p>` : undefined;

  const result: ConsentTextOutput = {
    processingHtml,
    canonical,
    hash,
    version: "v1.0",
  };
  if (marketingHtml !== undefined) result.marketingHtml = marketingHtml;
  return result;
};

const TEMPLATES: Readonly<Record<string, ConsentTemplateFn>> = {
  "v1.0": v1_0,
};

export function isKnownConsentVersion(version: string): boolean {
  return version in TEMPLATES;
}

export function listConsentVersions(): readonly string[] {
  return Object.keys(TEMPLATES);
}

/**
 * Render a consent template by version. Throws on unknown version.
 * Use {@link CURRENT_CONSENT_VERSION} by default.
 */
export async function renderConsentText(
  version: string,
  input: ConsentTemplateInput,
): Promise<ConsentTextOutput> {
  const tpl = TEMPLATES[version];
  if (!tpl) {
    throw new Error(`Unknown consent template version: ${version}`);
  }
  return tpl(input);
}
