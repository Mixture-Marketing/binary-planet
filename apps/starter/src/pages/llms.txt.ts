import {
  buildLlmsTxt,
  buildLlmsTxtPro,
  type LlmsQaPair,
  type LlmsServiceQa,
  type LlmsTxtSection,
} from "@mixturemarketing/web-core/local";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import clientConfig from "../client.config.ts";
import { getProgrammaticPages } from "../lib/programmatic.ts";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { runtime?: { env?: { GEO_LLM_PRO_ENABLED?: string } } })?.runtime?.env;
  const isPro = String(env?.GEO_LLM_PRO_ENABLED ?? "").toLowerCase() === "true";
  const base = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;

  const sections: LlmsTxtSection[] = [
    {
      title: "Strony główne",
      links: [
        { url: `${base}/`, label: "Strona główna", description: "Główna strona firmy" },
        { url: `${base}/oferta`, label: "Usługi", description: "Pełna lista usług" },
        { url: `${base}/o-firmie`, label: "O firmie", description: "Informacje o firmie" },
        { url: `${base}/kontakt`, label: "Kontakt", description: "Dane kontaktowe i lokalizacja" },
        { url: `${base}/faq`, label: "FAQ", description: "Najczęściej zadawane pytania" },
      ],
    },
  ];

  const posts = (await getCollection("posts"))
    .filter((p) => p.data.published)
    .sort((a, b) => +b.data.date - +a.data.date);

  // Programmatic pages section
  const programmatic = await getProgrammaticPages();
  if (programmatic.pages.length > 0) {
    sections.push({
      title: "Usługi w okolicach",
      links: [
        { url: `${base}/uslugi`, label: "Mapa usług", description: "Wszystkie usługi z podziałem na miejscowości" },
        ...programmatic.pages.map((p) => {
          const sSlug = p.combo.service.slug;
          const lSlug = p.combo.location.slug ?? p.combo.location.name.toLowerCase();
          return {
            url: `${base}/uslugi/${sSlug}/${lSlug}`,
            label: `${p.combo.service.name} — ${p.combo.location.name}`,
            description: p.slots.description.slice(0, 140),
          };
        }),
      ],
    });
  }

  if (posts.length > 0) {
    sections.push({
      title: "Aktualności",
      links: [
        { url: `${base}/aktualnosci`, label: "Wszystkie wpisy", description: "Blog firmy" },
        ...posts.map((post) => ({
          url: `${base}/aktualnosci/${post.id}`,
          label: post.data.title,
          description: post.data.excerpt ?? `Wpis z ${post.data.date.toISOString().slice(0, 10)}`,
        })),
      ],
    });
  }

  // PRO mode — enhanced format with Q&A blocks
  if (isPro) {
    const faqEntries = await getCollection("faq").catch(() => []);
    const topQa: LlmsQaPair[] = faqEntries
      .filter((f) => f.data.published)
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99))
      .slice(0, 8)
      .map((f) => ({
        question: f.data.question,
        answer: typeof f.body === "string" ? f.body.replace(/\s+/g, " ").trim().slice(0, 350) : "",
      }));

    const servicesQa: LlmsServiceQa[] = clientConfig.services.map((s) => ({
      name: s.name,
      description: s.description,
      ...(s.priceFrom && { priceFrom: s.priceFrom }),
      qa: [
        { question: `Ile kosztuje ${s.name.toLowerCase()}?`, answer: s.priceFrom ? `Cena zaczyna się od ${s.priceFrom}. Skontaktuj się aby uzyskać dokładną wycenę.` : `Skontaktuj się aby uzyskać wycenę.` },
        { question: `Czy ${s.name.toLowerCase()} jest dostępna w ${clientConfig.address?.city ?? "okolicy"}?`, answer: `Tak, świadczymy usługę ${s.name.toLowerCase()} w ${clientConfig.address?.city ?? "naszej okolicy"} i okolicach.` },
      ],
    }));

    const hoursStr = clientConfig.hours
      ? Object.entries(clientConfig.hours)
          .filter(([k, v]) => k !== "note" && v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : undefined;

    const txt = buildLlmsTxtPro({
      name: clientConfig.business.name,
      summary: clientConfig.business.description,
      sections,
      business: {
        industry: clientConfig.business.industry,
        city: clientConfig.address?.city ?? "",
        ...(clientConfig.address?.street && { address: `${clientConfig.address.street}, ${clientConfig.address.city}` }),
        ...(clientConfig.contact?.phone && { phone: clientConfig.contact.phone }),
        ...(clientConfig.contact?.email && { email: clientConfig.contact.email }),
        ...(hoursStr && { hours: hoursStr }),
      },
      topQa,
      services: servicesQa,
    });
    return new Response(txt, { status: 200, headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }

  // Free baseline
  const txt = buildLlmsTxt({
    name: clientConfig.business.name,
    summary: clientConfig.business.description,
    sections,
  });

  return new Response(txt, {
    status: 200,
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
