# Fakturownia.pl setup — Track 7 (PL VAT invoices)

## 1. Konto Fakturownia

1. Zarejestruj: **https://app.fakturownia.pl/signup**
2. Wybierz **subdomenę** (np. `mixturemarketing`) — będzie w URL: `https://mixturemarketing.fakturownia.pl`. Tej wartości używamy jako `FAKTUROWNIA_LOGIN`.
3. Wypełnij dane firmy w **Ustawienia → Twoja firma**:
   - Nazwa firmy (na fakturach)
   - NIP / REGON
   - Adres siedziby
   - Konto bankowe (dla "Sposób zapłaty: przelew")
   - Numeracja faktur (default `FV/{rok}/{miesiac}/{lp}` — zostaw, lub własna)
4. Wybierz plan — **Plan Free** wystarczy do ~5 faktur/mc, dalej **Mini/Standard** (~30-100 zł/mc).

## 2. Wygeneruj API token

Ustawienia → **Integracje → API** → kliknij **Wygeneruj** (lub skopiuj istniejący).

Token wygląda jak: `oR8gJ7xZ.../yourLogin` (32+ znaków).

Skopiuj do `.dev.vars`:
```
FAKTUROWNIA_LOGIN="mixturemarketing"
FAKTUROWNIA_API_TOKEN="oR8gJ7xZ..."
FAKTUROWNIA_DRY_RUN="false"
```

## 3. Sanity check lokalnie

```powershell
cd D:\KOD\binary-planet\apps\control-plane
node --env-file=.dev.vars scripts/verify-fakturownia.mjs
```

Oczekiwany output:
```
Fakturownia credentials check — https://mixturemarketing.fakturownia.pl

  GET /account.json ... OK (MixtureMarketing (id=12345))
  GET /invoices.json?per_page=1 (read scope) ... OK (0 invoice(s) visible)
  POST /invoices.json (sandbox draft) ... OK (created id=999 number=FV/2026/05/0001 (cleaned up))

ALL CHECKS PASSED
```

Verify script tworzy **testową fakturę** + od razu ją kasuje. Jeśli DELETE failuje, faktura zostaje jako draft — usuń ręcznie w panelu.

## 4. Co dzieje się w produkcji

```
Klient płaci → Stripe webhook invoice.paid trafia do hub
              ↓
hub: handleInvoicePaid (api/routes/webhooks/stripe.ts)
   1. Zapis płatności do D1 payments table
   2. Wywołanie generateMonthlyInvoice() z scheduled/fakturownia-invoice.ts:
      a. Idempotency check (czy payment_id już ma invoice)
      b. Fetch klient + contact info z D1
      c. POST /invoices.json do Fakturownia z:
         - kind: 'vat'
         - buyer_name: client.legal_name lub business_name
         - buyer_tax_no: client.nip
         - positions: [{ name: "Pakiet Standard...", tax: 23, total_price_gross: "199.00" }]
         - paid: <kwota> → zapłacono w dniu wystawienia
         - send_to_email: true (Fakturownia wysyła PDF emailem do klienta)
      d. GET /invoices/{id}.pdf → ArrayBuffer
      e. R2.put("invoices/{client_id}/{number}.pdf", pdf)
      f. INSERT do D1 invoices table z fakturownia_id + pdf_r2_key
```

Klient widzi fakturę w **panel klienta** (`panel.mixturemarketing.pl/faktury`) — Track 2 czytał PDF z R2 (zobaczył już placeholder, teraz będzie miał real dane).

Klient też dostaje email od Fakturownia (z PDF attachment) — to jest **deafult zachowanie Fakturownia** gdy ustawisz `send_to_email: true` w invoice creation.

## 5. Production — secrety w Worker

```powershell
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler secret put FAKTUROWNIA_LOGIN          # mixturemarketing
pnpm exec wrangler secret put FAKTUROWNIA_API_TOKEN      # oR8gJ7xZ.../mixturemarketing
pnpm exec wrangler secret put FAKTUROWNIA_DRY_RUN        # false
```

## 6. JPK_V7 (rządowy raport VAT)

Fakturownia **automatycznie** generuje JPK_V7 miesięczny — wystarczy w panelu Fakturownia:
1. Ustawienia → Twoja firma → wpisać podpis kwalifikowany lub Profil Zaufany info
2. 25. każdego miesiąca: Raporty → JPK_V7 → wybierz miesiąc → wyślij

Schema D1 ma kolumny `jpk_exported_at` i `jpk_batch_id` w `invoices` — na razie nie używamy automatycznie, bo Fakturownia robi to za nas. Jeśli kiedyś chcemy wyświetlać status w panelu admin "wysłano do JPK", trzeba dodać cron który polluje Fakturownia API i aktualizuje te kolumny.

## 7. VAT-OSS (jeśli klient zagraniczny)

v0.1: zakładamy że klienci to PL B2B — wszyscy płacą VAT 23%. Jeśli kiedyś chcemy obsługiwać klientów z UE, trzeba:
1. Zarejestrować się w VAT-OSS (Ministerstwo Finansów)
2. W Fakturownia ustawić alternatywne stawki per-country
3. W hub: dodać logikę `tax_rate_from_country()` zamiast hardcoded 23

## 8. Korekta faktury

Brak automatyzacji w v0.1 — jak klient zwraca subskrypcję:
1. Stripe webhook `charge.refunded` → hub loguje audit_log warning
2. **Ty ręcznie** w Fakturownia: znajdź fakturę → "Wystaw korektę" → zapisz numer
3. W D1: aktualizuj `correction_invoice_id` w odpowiednim wierszu

W Track 7-v0.2 dodamy: webhook `charge.refunded` → POST /invoices/{id}/cancellation.json → auto-korekta.

## 9. Rate limits

Fakturownia API ~60 req/min per token. Provisioning generuje 2 calls per klient (create + download PDF) = bezpieczne do 30 klientów/min co i tak nie wystąpi.

Jeśli skalujesz powyżej, dodaj retry z exponential backoff w `fakturowniaRequest`.

## 10. Rotacja tokenu

Jeśli token wycieknie:
1. Ustawienia → Integracje → API → **Wygeneruj nowy** (stary momentalnie unieważnia się)
2. `pnpm exec wrangler secret put FAKTUROWNIA_API_TOKEN` z nowym
3. Redeploy hub: `pnpm exec wrangler deploy`
