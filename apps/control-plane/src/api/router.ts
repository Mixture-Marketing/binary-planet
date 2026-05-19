/**
 * Hono router composition. Single source of truth for all HTTP routes.
 */

import { Hono } from "hono";

import type { HonoEnv } from "../env.js";
import { notFoundHandler, onError } from "./middleware/error.js";
import { requestLogger } from "./middleware/logger.js";
import { authClientKey } from "./middleware/auth.js";
import { eventsRouter } from "./routes/events.js";
import { featureFlagsRouter } from "./routes/feature-flags.js";
import { healthRouter } from "./routes/health.js";
import { leadsRouter } from "./routes/leads.js";
import { adminCheckoutRouter } from "./routes/admin/checkout.js";
import { stripeWebhookRouter } from "./routes/webhooks/stripe.js";

export function createApp(): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  // Global middleware (order matters: logger first → catches everything)
  app.use("*", requestLogger);

  // Public — no auth
  app.route("/api/health", healthRouter);
  app.route("/api/webhooks/stripe", stripeWebhookRouter);
  // TODO Faza 3: P24 webhook, Fakturownia webhook, Resend webhook

  // Protected — require X-BP-Client-Key
  const protectedApi = new Hono<HonoEnv>();
  protectedApi.use("*", authClientKey);
  protectedApi.route("/leads", leadsRouter);
  protectedApi.route("/events", eventsRouter);
  protectedApi.route("/feature-flags", featureFlagsRouter);
  app.route("/api", protectedApi);

  // Admin API — separate auth (X-BP-Admin-Key, TODO Track 6-prod).
  // v0.1: open within same CF account, callers gated by network not by header.
  app.route("/api/admin/stripe/checkout", adminCheckoutRouter);

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
