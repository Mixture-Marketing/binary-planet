/**
 * Shared cron job whitelist — single source of truth for both the
 * /operations UI (operations.astro) and the proxy endpoint (api/cron/run.ts).
 *
 * Adding a new manual-trigger cron means: update CRON_JOBS here, redeploy.
 * Hub must also accept it server-side; this list is only the admin-side gate.
 */

export interface CronJob {
  slug: string;
  label: string;
  schedule: string;
  description: string;
}

export const CRON_JOBS: readonly CronJob[] = [
  {
    slug: "health_check_5min",
    label: "Health check",
    schedule: "co 5 min",
    description: "Ping wszystkich workerów klientów + alert na 5xx/timeout",
  },
  {
    slug: "provision_pending_2min",
    label: "Provision pending",
    schedule: "co 2 min",
    description: "Pobierz pending z kolejki i odpal pipeline provisioning",
  },
  {
    slug: "ai_blog_weekly",
    label: "AI blog draft",
    schedule: "co tydzień",
    description: "Wygeneruj draft posta blogowego dla klientów Premium+",
  },
  {
    slug: "backup_daily",
    label: "Backup D1",
    schedule: "codziennie",
    description: "Export D1 → R2 snapshot z retencją 30 dni",
  },
  {
    slug: "dataforseo_weekly",
    label: "DataForSEO sync",
    schedule: "co tydzień",
    description: "Aktualizuj pozycje GBP + keyword rankings",
  },
] as const;

export const CRON_JOB_SLUGS: readonly string[] = CRON_JOBS.map((j) => j.slug);

export function isAllowedCronJob(slug: string): boolean {
  return CRON_JOB_SLUGS.includes(slug);
}
