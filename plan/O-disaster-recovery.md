# APPENDIX O — Disaster Recovery & Status Page

## O.1 Disaster scenarios

| Scenariusz | Prawdopodobieństwo | Impact | Mitigation |
|---|---|---|---|
| CF region outage (1-2h) | Średnie (~2-4 razy rocznie) | Wszystkie strony w danym regionie offline | CF auto-failover do innego regionu (auto, transparent) |
| CF total outage (>1h global) | Niskie (1x ostatnie 2 lata) | Wszystko offline | Standby deploy na Vercel/Netlify dla Premium |
| D1 corruption / loss | Bardzo niskie | Utrata leadów, metryk | Daily R2 backup snapshots z 30-day retention |
| Stripe / Przelewy24 outage | Niskie | Nowi klienci nie mogą płacić | Fallback: ręczny przelew bank, email instruction |
| Anthropic API outage | Średnie | AI blog gen / GBP responses zatrzymane (nie krytyczne) | Retry w cron następnego dnia, fallback OpenAI |
| GitHub Actions outage | Niskie | Deploys zablokowane | Manual wrangler deploy z lokalu |

## O.2 Standby na Vercel (Premium tier)

**Architektura:**
- Każdy Premium klient ma GitHub Action `deploy-vercel-standby.yml` — co tydzień buduje na Vercel jako fallback
- Vercel deploy używa Plausible API z control plane przez webhook (CORS proxy)
- Jeśli CF down >15 min, DNS provider (Cloudflare DNS, oczywiście… circular dependency!) — ok, użyjemy zewnętrznego DNS dla Premium (Route53)
- Failover: zmiana DNS A record na Vercel IP (manual or automated by uptime monitor)

**Implementation detail:** to nie jest "100% feature parity z CF". Statyczna strona działa, form contact może działać (Vercel Functions), ale GBP integracja nie, bo wymaga control plane. Akceptujemy degraded mode.

**Kiedy używać:** tylko dla Premium klientów (799 zł setup + 599 zł/mc uzasadnia dodatkowy 5-10 zł/mc koszt Vercel hostingu).

## O.3 Status page (status.binary-planet.pl)

**Implementacja:** statyczna Astro strona z:
- Auto-updates z health monitor data (D1 → JSON → strona statyczna build co 1 min)
- Komponenty: status każdego komponentu (CF Workers, D1, R2, Stripe, Anthropic, GBP API, etc.)
- Historia incidentów (z postmortemami)
- Subscribe email/RSS dla updates

**Alternatywa:** Better Stack Status Page (free tier wystarczy na start, $29/mc dla custom domain).

**Comunikacja:**
- Automatic status updates podczas wykrytych awarii
- Tweet/post na binary-planet socials
- Email do affected klientów z explanation
- W panelu klienta widget "System status: All systems operational ✓"

## O.4 Backup strategy

**Co backupujemy:**
- D1 control plane → daily dump do R2 (`bp-backups/control-plane/YYYY-MM-DD.sql.gz`)
- Repo każdego klienta — GitHub IS backup (już distributed), ale daily commit `binary-planet-backups` snapshot zip
- R2 client content (media uploads) → cross-region replication (`bp-media-replica` w innym regionie)
- Secrets (Worker secrets) → eksport do bezpiecznego backupu offline raz w mc

**Retention:**
- Daily backups: 30 dni
- Weekly backups: 12 tygodni
- Monthly backups: 12 miesięcy
- Yearly snapshots: bezterminowo

**Restore test:** raz na kwartał — restore z backupu do test environment, weryfikacja integralności.

---
