# APPENDIX N — Fakturownia.pl + Polish VAT + JPK_V7

## N.1 Problem

- Większość klientów PL będzie VAT-podatnikami (mikrofirmy często nie, ale wszyscy >200k obrotu rocznie tak)
- Twoja agencja musi wystawiać faktury VAT (przy ryczałcie 12% IT lub na zasadach ogólnych)
- Wymóg JPK_V7 (Jednolity Plik Kontrolny) wysyłany do US co miesiąc
- Stripe wystawia "receipts" ale nie faktury VAT po polsku
- Przelewy24 wystawia faktury VAT (dla Polski) ale tylko jeśli używasz ich Online Faktura — dodatkowy koszt

## N.2 Rekomendacja: Fakturownia.pl

**Integracja:**
- Fakturownia REST API + webhooks
- Po sukcesie płatności (Stripe lub P24 webhook) → wywołanie Fakturownia API → wystawienie faktury VAT → PDF link → email do klienta przez Resend
- JPK_V7 auto-generowane miesięcznie w Fakturowni → wysyłka do MF (manual click)

**Koszty:** Fakturownia od 19 zł/mc (do 50 faktur), wyższe plany ~99 zł/mc (unlimited). Marginalny koszt vs MRR.

**Alternatywy:**
- WFirma — podobny zakres, podobne ceny
- inFakt — automatyzacja, drogie
- Self-host na D1 — nie polecam, prawo zmienia się, nie warto utrzymywać

## N.3 VAT settings

- VAT 23% domyślny dla usług IT/marketingu w PL
- Dla klientów EU (jeśli się trafią) reverse charge — Fakturownia automatycznie
- Dla klientów spoza EU export — VAT 0%

## N.4 Implementacja w control plane

```typescript
// fakturownia.client.ts
async function issueInvoice(clientId: string, paymentId: string) {
  const client = await db.get(`SELECT * FROM clients WHERE id = ?`, clientId);
  const payment = await db.get(`SELECT * FROM payments WHERE id = ?`, paymentId);
  
  const invoice = await fakturownia.invoices.create({
    kind: 'vat',
    buyer_name: client.legal_name || client.business_name,
    buyer_nip: client.nip,
    buyer_post_code: client.postal_code,
    buyer_city: client.city,
    buyer_street: client.street,
    positions: [{
      name: getInvoiceLineDescription(payment.type, payment.metadata),
      quantity: 1,
      total_price_gross: payment.amount_pln / 100,
      tax: 23
    }],
    payment_to_kind: 'paid',
    paid: payment.amount_pln / 100,
    sell_date: payment.paid_at,
    issue_date: payment.paid_at,
  });
  
  await db.run(`UPDATE payments SET invoice_id = ?, invoice_pdf_url = ? WHERE id = ?`,
    invoice.id, invoice.pdf_url, paymentId);
  
  await resend.send({
    to: client.contact_email,
    subject: `Faktura VAT ${invoice.number}`,
    attachments: [{ url: invoice.pdf_url }]
  });
}
```

---
