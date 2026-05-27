/**
 * Hono router composition. Single source of truth for all HTTP routes.
 */

import { Hono } from "hono";

import type { HonoEnv } from "../env.js";
import { notFoundHandler, onError } from "./middleware/error.js";
import { requestLogger } from "./middleware/logger.js";
import { authClientKey } from "./middleware/auth.js";
import { corsMiddleware } from "./middleware/cors.js";
import { eventsRouter } from "./routes/events.js";
import { featureFlagsRouter } from "./routes/feature-flags.js";
import { healthRouter } from "./routes/health.js";
import { leadsRouter } from "./routes/leads.js";
import { adminCheckoutRouter } from "./routes/admin/checkout.js";
import { adminAddonsRouter } from "./routes/admin/addons.js";
import { adminBackupRouter } from "./routes/admin/backup.js";
import { adminCronRouter } from "./routes/admin/cron.js";
import { deployNotifyRouter } from "./routes/admin/deploy-notify.js";
import { adminExtraSubpageRouter } from "./routes/admin/extra-subpage.js";
import { adminLifecycleRouter } from "./routes/admin/lifecycle.js";
import { adminNewsletterRouter } from "./routes/admin/newsletter.js";
import { adminOvhRouter } from "./routes/admin/ovh.js";
import { adminSiteMigrationRouter } from "./routes/admin/site-migration.js";
import { adminUpgradeDomainRouter } from "./routes/admin/upgrade-domain.js";
import { adminDeleteKlientRepoRouter } from "./routes/admin/delete-klient-repo.js";
import { preonboardRouter } from "./routes/admin/preonboard.js";
import { sveltiaOauthRouter } from "./routes/sveltia-oauth.js";
import { stripeWebhookRouter } from "./routes/webhooks/stripe.js";

export function createApp(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  // Global middleware (order matters)
  app.use("*", corsMiddleware);  // 1st: handles OPTIONS preflight, adds headers to responses
  app.use("*", requestLogger);   // 2nd: logs every request (incl. preflights that don't pass through)

  // Public — no auth
  app.route("/api/health", healthRouter);
  app.route("/api/webhooks/stripe", stripeWebhookRouter);
  // Sveltia CMS OAuth proxy — public (this IS auth handshake, klient-facing)
  app.route("/api/sveltia", sveltiaOauthRouter);
  // TODO Faza 3: P24 webhook, Fakturownia webhook, Resend webhook

  // Admin API — separate auth (X-BP-Admin-Key from env.ADMIN_API_KEY).
  // MUST be registered BEFORE protected /api catch-all below — otherwise
  // authClientKey middleware intercepts these routes first.
  app.route("/api/admin/stripe/checkout", adminCheckoutRouter);
  app.route("/api/admin/cron/run-now", adminCronRouter);
  app.route("/api/admin/ovh", adminOvhRouter);
  app.route("/api/admin/deploy-notify", deployNotifyRouter);
  app.route("/api/admin/addons", adminAddonsRouter);
  app.route("/api/admin/lifecycle", adminLifecycleRouter);
  app.route("/api/admin/backup", adminBackupRouter);
  app.route("/api/admin/newsletter", adminNewsletterRouter);
  app.route("/api/admin/extra-subpage", adminExtraSubpageRouter);
  app.route("/api/admin/site-migration", adminSiteMigrationRouter);
  app.route("/api/admin/clients", adminUpgradeDomainRouter);
  app.route("/api/admin/clients/delete-repo", adminDeleteKlientRepoRouter);
  // Newsletter public endpoints (confirm + unsubscribe — klikalne z maila)
  app.route("/api/newsletter", adminNewsletterRouter);
  // Preonboard — public-ish, X-BP-Preonboard-Key auth, rate-limited per IP
  app.route("/api/admin/preonboard", preonboardRouter);

  // Protected — require X-BP-Client-Key
  const protectedApi = new Hono<HonoEnv>();
  protectedApi.use("*", authClientKey);
  protectedApi.route("/leads", leadsRouter);
  protectedApi.route("/events", eventsRouter);
  protectedApi.route("/feature-flags", featureFlagsRouter);
  app.route("/api", protectedApi);

  // Admin UI placeholder — Astro Server Islands w przyszłości
  // TODO Faza 3-4: Astro dashboard pages
  app.get("/", (c) => c.text("MM Control Plane v0.0.1\nGo to /api/health"));
  app.get("/admin", (c) =>
    c.html(
      `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>MM Control Plane</title></head>
       <body style="font-family:system-ui;padding:40px;">
         <h1>MixtureMarketing Control Plane</h1>
         <p>Admin dashboard — w budowie (Track J2).</p>
         <ul>
           <li><a href="/api/health">/api/health</a></li>
         </ul>
       </body></html>`,
    ),
  );

  // Catchall
  app.notFound(notFoundHandler);
  app.onError(onError);

  return app;
}
