/**
 * FAQPage JSON-LD builder.
 *
 * Google's FAQ rich results were rolled back to "limited" in Aug 2023 — now shown only
 * for "well-known authoritative websites in government, health". For service businesses,
 * FAQ schema is STILL valuable for:
 *   - AI Overviews / AI search (Perplexity, ChatGPT use FAQ as direct citations)
 *   - Voice search (Siri/Alexa pull from FAQ schema)
 *   - Future ranking signal (Google has not removed the schema, just rich-result display)
 *
 * Recommendation: always use on /uslugi/* and /kontakt for service businesses.
 */

import { SCHEMA_CONTEXT } from "./types.js";

export interface FaqItem {
  question: string;
  /** Plain text or HTML answer. Recommended <500 chars per item. */
  answer: string;
}

export interface FaqPageJsonLd {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id"?: string;
  mainEntity: QuestionJsonLd[];
}

export interface QuestionJsonLd {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

export interface FaqInput {
  /** Optional page URL — used as @id. */
  url?: string;
  items: ReadonlyArray<FaqItem>;
}

export function faqPageSchema(input: FaqInput): FaqPageJsonLd {
  if (input.items.length === 0) {
    throw new Error("faqPageSchema: at least one FAQ item required");
  }
  for (const item of input.items) {
    if (!item.question.trim()) throw new Error("faqPageSchema: each item needs question");
    if (!item.answer.trim()) throw new Error("faqPageSchema: each item needs answer");
  }

  const out: FaqPageJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: input.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  if (input.url) out["@id"] = input.url;
  return out;
}
