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
