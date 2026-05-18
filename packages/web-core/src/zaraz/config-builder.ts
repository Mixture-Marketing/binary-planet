/**
 * High-level config builder: take IntegrationFlags (typically from client.config.integrations)
 * → return ZarazToolConfig[] ready to provision via CF API.
 *
 * Usage:
 *   const { tools } = buildZarazTools(clientConfig.integrations);
 *   await provisionToolsToCloudflare(tools);  // CF API call (caller responsibility)
 */

import {
  clarityTool,
  customHtmlTool,
  ga4Tool,
  googleAdsTool,
  linkedinInsightTool,
  metaPixelTool,
  plausibleTool,
  tiktokPixelTool,
} from "./tool-configs.js";
import type { BuildToolsOutput, IntegrationFlags } from "./types.js";

export function buildZarazTools(flags: IntegrationFlags): BuildToolsOutput {
  const tools: BuildToolsOutput["tools"] = [];
  const warnings: string[] = [];

  // Plausible (cookieless — always on if enabled)
  if (flags.plausible) {
    const opts = typeof flags.plausible === "object" ? flags.plausible : {};
    tools.push(plausibleTool(opts));
  }

  if (flags.ga4) {
    try {
      tools.push(ga4Tool({ measurementId: flags.ga4 }));
    } catch (err) {
      warnings.push(`ga4: ${err instanceof Error ? err.message : "config invalid"}`);
    }
  }

  if (flags.googleAds) {
    try {
      tools.push(
        googleAdsTool({
          conversionId: flags.googleAds.conversionId,
          ...(flags.googleAds.conversionLabel && {
            leadConversionLabel: flags.googleAds.conversionLabel,
          }),
        }),
      );
    } catch (err) {
      warnings.push(`googleAds: ${err instanceof Error ? err.message : "config invalid"}`);
    }
  }

  if (flags.metaPixel) {
    try {
      tools.push(metaPixelTool({ pixelId: flags.metaPixel }));
    } catch (err) {
      warnings.push(`metaPixel: ${err instanceof Error ? err.message : "config invalid"}`);
    }
  }

  if (flags.tiktokPixel) {
    tools.push(tiktokPixelTool({ pixelId: flags.tiktokPixel }));
  }

  if (flags.clarity) {
    tools.push(clarityTool({ projectId: flags.clarity }));
  }

  if (flags.linkedinInsight) {
    tools.push(linkedinInsightTool({ partnerId: flags.linkedinInsight }));
  }

  for (const custom of flags.customHtml ?? []) {
    tools.push(
      customHtmlTool({
        name: custom.name,
        html: custom.html,
        ...(custom.purposes && { purposes: [...custom.purposes] }),
      }),
    );
  }

  if (tools.length === 0) {
    warnings.push("buildZarazTools: no integrations enabled (Zaraz config will be empty)");
  }

  return { tools, warnings };
}
