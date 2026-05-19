import { buildLlmsTxt, type LlmsTxtSection } from "@mixturemarketing/web-core/local";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import clientConfig from "../client.config.ts";
import { getProgrammaticPages } from "../lib/programmatic.ts";

export const prerender = false;

export const GET: APIRoute = async () => {
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
