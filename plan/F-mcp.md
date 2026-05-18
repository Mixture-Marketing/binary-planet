# APPENDIX F — Dodatkowe MCP do instalacji (instrukcje)

Dla optymalnej pracy nad implementacją warto doinstalować:

## F.1 Stripe MCP (priorytet 1)

```powershell
claude mcp add --transport http stripe https://mcp.stripe.com -H "Authorization: Bearer sk_test_..."
```

Po dodaniu w `~/.claude.json` (lub via `/mcp` w Claude Code). Wymaga Stripe API key (test mode na start).

## F.2 GitHub MCP (priorytet 1) — częściowo już dostępne

W deferred tools widzę `mcp__github__authenticate` — czyli MCP jest zainstalowany ale wymaga autoryzacji. W Claude Code wpisz `/mcp` i autoryzuj.

Pełny MCP github (z create_repository, create_pull_request etc.):
```powershell
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```
Wymaga GitHub PAT w env.

## F.3 Figma MCP (opcjonalne, dla theme presets design)

```powershell
claude mcp add figma -- npx -y figma-mcp
```
Wymaga Figma access token. Tylko jeśli chcesz projektować presety w Figmie przed kodem.

## F.4 Skills

Wszystkie potrzebne SEO skills są już dostępne. Skill **mcp-builder** może się przydać jeśli zbudujemy własny MCP dla naszego control plane (kontekst dla AI że może czytać dashboard danych klientów).

Po fazie 4 (control plane v0.1) warto zbudować **`binary-planet-mcp`** — własny MCP dla agenta blog-AI z dostępem do `seo_metrics`, `keyword_rankings`, `gbp_reviews`. To pozwoli ci pytać Claude'a "co napisać dla klienta XYZ na blog?" w naturalnym języku.

---
