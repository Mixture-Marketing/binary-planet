# APPENDIX R — Wizualne diagramy architektury

## R.1 System Overview (hub-and-spoke + external)

```mermaid
graph TB
    subgraph "Twoje konto Cloudflare (HUB)"
        HUB[api.binary-planet.pl<br/>Astro Dashboard + Hono API]
        DB[(D1: clients, subscriptions,<br/>leads, citations, reviews,<br/>blog_drafts, prospects)]
        AE[(Workers Analytics Engine:<br/>page_view, scroll, engagement)]
        R2[(R2: backups, media,<br/>audit logs Parquet)]
        KV[(KV: feature flags,<br/>rate limits, sessions)]
        HUB --- DB
        HUB --- AE
        HUB --- R2
        HUB --- KV
    end
    
    subgraph "Strony klientów (SPOKES)"
        direction LR
        S1[Ślusarz Kowalski<br/>slusarz-kowalski.pl]
        S2[Mechanik Nowak<br/>mechanik-nowak.pl]
        S3[Księgowy Smith<br/>ksiegowy-smith.pl]
        S4[...100+ klientów]
    end
    
    subgraph "External APIs (tylko HUB woła)"
        GSC[Google Search Console]
        GA4[Google Analytics 4]
        GBP[Google Business Profile]
        DFS[DataForSEO]
        ANT[Anthropic Claude]
        RES[Resend Email]
        SMS[SMSAPI.pl]
        STR[Stripe + Przelewy24]
        FAK[Fakturownia.pl]
    end
    
    subgraph "Panel klienta (Customer Portal)"
        PK[panel.binary-planet.pl/...]
    end
    
    S1 -.->|leads + events<br/>X-BP-Client-Key| HUB
    S2 -.->|leads + events| HUB
    S3 -.->|leads + events| HUB
    S4 -.->|leads + events| HUB
    
    HUB ==>|daily pull| GSC
    HUB ==>|daily pull| GA4
    HUB ==>|daily pull| GBP
    HUB ==>|weekly pull| DFS
    HUB ==>|AI gen| ANT
    HUB ==>|email| RES
    HUB ==>|SMS| SMS
    HUB ==>|billing| STR
    HUB ==>|faktury VAT| FAK
    
    PK ==>|leads/metrics view| HUB
```

## R.2 Lead Flow (ktoś wypełnia formularz)

```mermaid
sequenceDiagram
    autonumber
    participant V as Odwiedzający
    participant S as Worker Ślusarza (SPOKE)
    participant H as Hub (Control Plane)
    participant R as Resend
    participant K as Ślusarz Kowalski
    participant J as Jakub (Dashboard)
    participant A as Anna (lead)
    
    V->>S: POST /api/contact<br/>{name, email, phone, message}
    activate S
    S->>S: Turnstile validate
    S->>S: Rate limit check (KV)
    S->>S: Sanitize input
    S->>H: POST /api/leads<br/>X-BP-Client-Key: ck_live_xxx
    activate H
    H->>H: Verify API key
    H->>H: INSERT lead D1
    H->>H: Audit log (RODO)
    
    par Email to klient
        H->>R: Send email
        R->>K: "Nowy lead: Anna z Pobitnej"
    and Notify dashboard
        H->>J: WebSocket: nowy lead
    end
    
    H-->>S: 200 OK {lead_id}
    deactivate H
    S-->>V: "Dziękujemy!"
    deactivate S
    
    Note over H,A: 7 dni później (jeśli moduł Reputation aktywny)
    H->>SMS: Schedule review request
    SMS->>A: "Cześć Anna, wystaw opinię: bp.gl/abc"
    A->>GBP: Zostawia opinię ★★★★★
    
    Note over H: Co 30 min cron
    H->>GBP: Fetch new reviews
    H->>H: AI generate response suggestion
    H->>J: WebSocket: review do approve
    J->>H: Approve response
    H->>GBP: Post response
```

## R.3 Onboarding Flow (klient kupuje, dostaje stronę)

```mermaid
sequenceDiagram
    autonumber
    participant K as Klient (ślusarz)
    participant W as Wizard
    participant REG as REGON GUS API
    participant ANT as Anthropic
    participant P as Przelewy24
    participant WF as Provisioning Workflow
    participant GH as GitHub API
    participant CF as Cloudflare API
    participant DNS as DNS (klient)
    participant J as Jakub
    
    K->>W: Wybiera branżę → suggest theme preset
    K->>W: Wpisuje NIP
    W->>REG: Fetch firma {nip}
    REG-->>W: Nazwa, adres, REGON, PKD, status
    K->>W: Potwierdza + lokalizacja + service area
    K->>W: Lista usług + godziny + zdjęcia
    K->>W: USP, kim jesteś, krótki opis
    W->>ANT: Generate content (hero, about, services, FAQ)
    ANT-->>W: Drafts
    K->>W: Reviews + edits content
    K->>W: Wybiera tier (Starter/Standard/Premium)
    K->>W: Akceptuje DPA + Regulamin + Polityka
    W->>P: Checkout (BLIK/karta)
    P-->>WF: Webhook payment success
    activate WF
    
    WF->>GH: Create repo from template
    WF->>GH: Write client.config.ts + content
    WF->>CF: Create Worker + bindings
    WF->>CF: Create Custom Hostname
    WF->>GH: Trigger deploy workflow
    
    loop Poll DNS verification (max 1h)
        WF->>CF: Check Custom Hostname status
    end
    
    WF->>K: Email "Strona gotowa!" + DNS instructions
    WF->>J: Slack: "Nowy klient — review w batchu"
    deactivate WF
    
    Note over K,DNS: Klient ustawia DNS lub kupuje domenę od nas
    K->>DNS: CNAME → CF for SaaS
    DNS-->>CF: Verified, SSL provisioned
    
    Note over J: Następny wieczór (batch 15 min review)
    J->>J: Review jakości designu i content
    J->>K: Email "Wszystko gotowe, miłej pracy!"
```

## R.4 Faza implementacji — Gantt

```mermaid
gantt
    title Plan implementacji binary-planet (zrewidowany)
    dateFormat YYYY-MM-DD
    section Walidacja rynku
    Faza -1 Walidacja rynku   :crit, val, 2026-06-01, 30d
    section Setup
    Faza 0 Setup infra + prawnik  :crit, f0, after val, 14d
    section Core
    Faza 1 web-core v0.1        :f1, after f0, 14d
    section Starter
    Faza 2 starter + 6 themes   :f2, after f1, 21d
    section Onboarding
    Faza 3 wizard + control plane :crit, f3, after f2, 28d
    section Pilot
    Faza 4 5 klientów pilot     :f4, after f3, 28d
    section Local SEO
    Faza 5 citations + GBP + rep :f5, after f4, 14d
    section Reporting
    Faza 6 monthly reports       :f6, after f5, 10d
    section Blog + GEO
    Faza 7 blog AI + GEO         :f7, after f6, 14d
    section Skalowanie
    Faza 8 skalowanie + VA       :f8, after f7, 90d
```

Total: ~9 mc do skalowania (Faza -1 = mc 1, Faza 0-6 = mc 2-5, Faza 7-8 = mc 6-9+).

## R.5 Customer Lifecycle

```mermaid
journey
    title Customer journey klienta ślusarza
    section Akwizycja
      Reklama / polecenie: 3: Klient
      Wejście na landing: 4: Klient
      Wizard start: 4: Klient
      Wizard complete: 5: Klient
      Płatność: 4: Klient
    section Onboarding (Day 1-7)
      Strona live <30 min: 5: Klient
      Email "Witamy": 5: Klient
      GBP setup przez nas: 5: Jakub
      DNS configured: 4: Klient
      Pierwszy GBP post: 4: Jakub
    section Care (Month 1)
      5 katalogów submitted: 5: Jakub
      Lighthouse 95+ email: 5: Klient
      Pierwsze GSC impressions: 4: Klient
      Pierwsze GBP views: 4: Klient
      Pierwsza recenzja SMS: 5: Klient
    section Value (Month 2-6)
      Local pack appearance: 5: Klient
      Pierwszy lead z formy: 5: Klient
      Miesięczny raport PDF: 5: Klient
      Upsell propozycja: 4: Jakub
    section Renewal
      Mc 12 review: 4: Jakub
      Renewal decision: 4: Klient
      Upgrade Standard/Premium: 5: Klient
```

## R.6 Modules / Pakiety (które klient kupuje)

```mermaid
flowchart LR
    subgraph CORE["Rdzeń (każdy klient)"]
        H[Hosting + SSL + Backup]
        F[Formularz + Turnstile]
        S[SEO base: schema, sitemap, robots]
        C[CMS Sveltia]
        A[A11y + CWV 95+]
        I[Plausible analytics]
    end
    
    subgraph STARTER["Starter (149 zł/mc)"]
        CORE
        GBPB[GBP basic setup]
        CAT5[5 katalogów NAP]
        GBPP[4 GBP posts/mc AI]
        RAP[Mini-raport miesięczny]
    end
    
    subgraph STD["Standard (299 zł/mc)"]
        STARTER
        CAT30[30 katalogów NAP]
        TRACK[Keyword tracking DataForSEO]
        PROG[2 nowe programmatic pages/mc]
        REP[Reputation Manager SMS]
        RAPF[Full PDF report]
    end
    
    subgraph PREM["Premium (599 zł/mc)"]
        STD
        BLG[Blog AI 4 art/mc]
        CONV[Conversion: A/B + Clarity]
        DR[Disaster Recovery standby]
        SUPP[Priority support]
    end
    
    subgraph ADDONS["Dodatki à la carte"]
        MULTI[Multi-location +79 zł/loc]
        GEO[GEO/AI Citation +149 zł]
        EXTR[Extra blog +49 zł/post]
        WEBHOOKS[Custom webhooks +99 zł]
    end
```

---
