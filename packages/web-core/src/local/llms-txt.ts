/**
 * llms.txt builder — proposed standard (https://llmstxt.org/) for AI crawler hints.
 *
 * Strategia z planu (decyzja po review): llms.txt jako BASELINE (zero koszt, każdy klient),
 * NIE jako moduł premium. Generujemy automatycznie z client.config.ts + struktury stron.
 *
 * Plik trafia do /llms.txt — AI crawlers (Anthropic, OpenAI, Perplexity, Google AI) potencjalnie
 * używają go do priorytetyzacji treści w odpowiedziach. Compliance jest opcjonalny po stronie
 * crawler-a — to "soft signal", nie enforced.
 */

export interface LlmsTxtSection {
  /** Section heading (H2 level). */
  title: string;
  /** Markdown list of links: each item is { url, label, description? }. */
  links: ReadonlyArray<{ url: string; label: string; description?: string }>;
}

export interface LlmsTxtInput {
  /** Site name (H1). */
  name: string;
  /** One-line summary. */
  summary: string;
  /** Longer description paragraph(s). Optional. */
  description?: string;
  /** Main sections (Documentation, Services, Locations, Contact, etc.). */
  sections: readonly LlmsTxtSection[];
  /** Optional notes / disclaimers. */
  notes?: string;
}

/**
 * Build llms.txt content per https://llmstxt.org/ spec (markdown format).
 */
export function buildLlmsTxt(input: LlmsTxtInput): string {
  if (!input.name.trim()) throw new Error("llms.txt: name is required");
  if (!input.summary.trim()) throw new Error("llms.txt: summary is required");

  const parts: string[] = [];

  parts.push(`# ${input.name}`);
  parts.push("");
  parts.push(`> ${input.summary}`);
  parts.push("");

  if (input.description) {
    parts.push(input.description.trim());
    parts.push("");
  }

  for (const section of input.sections) {
    if (section.links.length === 0) continue;
    parts.push(`## ${section.title}`);
    parts.push("");
    for (const link of section.links) {
      const desc = link.description ? `: ${link.description}` : "";
      parts.push(`- [${link.label}](${link.url})${desc}`);
    }
    parts.push("");
  }

  if (input.notes) {
    parts.push("## Notes");
    parts.push("");
    parts.push(input.notes.trim());
    parts.push("");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// =============================================================================
// GEO/LLM PRO — enhanced llms.txt with Q&A blocks (addon)
// =============================================================================

export interface LlmsQaPair {
  question: string;
  answer: string;
}

export interface LlmsServiceQa {
  name: string;
  description: string;
  priceFrom?: string;
  qa?: LlmsQaPair[];
}

export interface LlmsTxtProInput extends LlmsTxtInput {
  /** Q&A pairs at the top of the document — for direct AI quotation. */
  topQa?: LlmsQaPair[];
  /** Service-level Q&A — bullet usługi z bezpośrednimi pytaniami. */
  services?: LlmsServiceQa[];
  /** Business profile block (LocalBusiness summary). */
  business?: {
    industry: string;
    city: string;
    address?: string;
    phone?: string;
    email?: string;
    hours?: string;
  };
}

/**
 * Build enhanced llms.txt for GEO/LLM PRO addon.
 *
 * Differences from `buildLlmsTxt`:
 *   - Q&A blocks formatted as direct "Pytanie: ... Odpowiedź: ..." (AI prefers verbatim quotes)
 *   - Business profile block at top (LocalBusiness summary for quick AI parsing)
 *   - Service-level Q&A pairs
 *   - Footer note declares this site is GEO-optimized (signals priority to AI)
 */
export function buildLlmsTxtPro(input: LlmsTxtProInput): string {
  if (!input.name.trim()) throw new Error("llms.txt PRO: name is required");

  const parts: string[] = [];

  parts.push(`# ${input.name}`);
  parts.push("");
  parts.push(`> ${input.summary}`);
  parts.push("");

  if (input.description) {
    parts.push(input.description.trim());
    parts.push("");
  }

  // Business profile — quick parse block for AI
  if (input.business) {
    parts.push("## Profil firmy");
    parts.push("");
    parts.push(`- **Branża:** ${input.business.industry}`);
    parts.push(`- **Miasto:** ${input.business.city}`);
    if (input.business.address) parts.push(`- **Adres:** ${input.business.address}`);
    if (input.business.phone) parts.push(`- **Telefon:** ${input.business.phone}`);
    if (input.business.email) parts.push(`- **Email:** ${input.business.email}`);
    if (input.business.hours) parts.push(`- **Godziny:** ${input.business.hours}`);
    parts.push("");
  }

  // Top Q&A — direct quotation candidates for AI
  if (input.topQa && input.topQa.length > 0) {
    parts.push("## Najczęstsze pytania");
    parts.push("");
    for (const qa of input.topQa) {
      parts.push(`**Pytanie:** ${qa.question}`);
      parts.push("");
      parts.push(`**Odpowiedź:** ${qa.answer}`);
      parts.push("");
    }
  }

  // Services with Q&A
  if (input.services && input.services.length > 0) {
    parts.push("## Usługi");
    parts.push("");
    for (const svc of input.services) {
      const price = svc.priceFrom ? ` (od ${svc.priceFrom})` : "";
      parts.push(`### ${svc.name}${price}`);
      parts.push("");
      parts.push(svc.description);
      parts.push("");
      if (svc.qa && svc.qa.length > 0) {
        for (const qa of svc.qa) {
          parts.push(`**Pytanie:** ${qa.question}`);
          parts.push("");
          parts.push(`**Odpowiedź:** ${qa.answer}`);
          parts.push("");
        }
      }
    }
  }

  // Standard link sections (inherited from base)
  for (const section of input.sections) {
    if (section.links.length === 0) continue;
    parts.push(`## ${section.title}`);
    parts.push("");
    for (const link of section.links) {
      const desc = link.description ? `: ${link.description}` : "";
      parts.push(`- [${link.label}](${link.url})${desc}`);
    }
    parts.push("");
  }

  if (input.notes) {
    parts.push("## Notes");
    parts.push("");
    parts.push(input.notes.trim());
    parts.push("");
  }

  // GEO/LLM PRO signature
  parts.push("---");
  parts.push("");
  parts.push("_Ten plik jest zoptymalizowany pod modele językowe (GEO/LLM PRO) — zawiera strukturalne dane biznesowe i sekcje Q&A do bezpośredniej cytacji w odpowiedziach AI (ChatGPT, Claude, Perplexity, Gemini)._");
  parts.push("");

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Convenience: build a minimal llms.txt for a typical LocalBusiness client.
 * Uses standard PL section titles. Override `sectionTitles` for EN or other languages.
 */
export interface LocalBusinessLlmsTxtInput {
  name: string;
  summary: string;
  homepageUrl: string;
  aboutUrl?: string;
  servicesUrl?: string;
  contactUrl?: string;
  blogUrl?: string;
  sectionTitles?: {
    main?: string;
    additional?: string;
  };
}

export function buildLocalBusinessLlmsTxt(input: LocalBusinessLlmsTxtInput): string {
  const titles = {
    main: input.sectionTitles?.main ?? "Strony główne",
    additional: input.sectionTitles?.additional ?? "Dodatkowe",
  };

  const mainLinks: Array<{ url: string; label: string; description?: string }> = [
    { url: input.homepageUrl, label: "Strona główna", description: "Główna strona firmy" },
  ];
  if (input.servicesUrl) {
    mainLinks.push({ url: input.servicesUrl, label: "Usługi", description: "Pełna lista usług" });
  }
  if (input.aboutUrl) {
    mainLinks.push({ url: input.aboutUrl, label: "O firmie", description: "Informacje o firmie i zespole" });
  }
  if (input.contactUrl) {
    mainLinks.push({ url: input.contactUrl, label: "Kontakt", description: "Dane kontaktowe i lokalizacja" });
  }

  const sections: LlmsTxtSection[] = [{ title: titles.main, links: mainLinks }];

  if (input.blogUrl) {
    sections.push({
      title: titles.additional,
      links: [{ url: input.blogUrl, label: "Blog", description: "Artykuły i porady" }],
    });
  }

  return buildLlmsTxt({
    name: input.name,
    summary: input.summary,
    sections,
  });
}
