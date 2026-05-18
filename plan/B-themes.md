# APPENDIX B — Theme Presets (6 branżowych)

Każdy theme preset = osobny folder w `binary-planet-starter/themes/[preset]/` z:
- `layouts/` — BaseLayout + branżowe variants
- `components/` — sekcje optymalne pod branżę
- `tokens.css` — 5 wariantów kolorystycznych (klient wybiera w wizardzie)
- `sections/` — predefined sekcje (Hero, Services, About, Reviews, FAQ, CTA, Contact)
- `copy-templates/` — prompty AI dla copywriting per preset
- `eeat-blocks/` — AuthorBox, Credentials, Experience signals

## B.1 `craftsman` — ślusarz, mechanik, hydraulik, elektryk, dekarz, glazurnik

**Charakter:** zaufanie + dostępność + cena. Targetuje urgent local searches.

**Layout:**
- Hero: duży telefon "kliknij i zadzwoń", informacja "dojazd w 30 min", godziny otwarcia widoczne natychmiast
- Sekcje: Usługi z cennikiem orientacyjnym (z `pricing.yaml`), Strefa dojazdu (mapa + lista dzielnic), Opinie z imieniem + miastem, Galeria realizacji, FAQ z lokalnymi pytaniami, Sekcja "O nas" z imieniem właściciela + zdjęciem + doświadczenie, certyfikaty
- Sticky CTA "Zadzwoń teraz" + "Napisz SMS" na mobile
- Schema: `Locksmith` / `AutoRepair` / `Plumber` / `Electrician` / `RoofingContractor` (subtyp wybierany)

**Warianty kolorystyczne (5):** Industrial (granat + pomarańcz), Trust (granat + biały), Bold (czerwień + czarny), Friendly (żółty + niebieski), Premium (czarny + złoty)

**EEAT blocks:**
- AuthorBox z właścicielem (imię, lat doświadczenia, członkostwo cechu/izby)
- Credentials sekcja (zdjęcia certyfikatów)
- "Wykonane realizacje" z licznikiem (z bazy)

**AI copy templates:** prompty dla hero, about, service descriptions zorientowane na local trust + urgency.

## B.2 `professional` — księgowy, notariusz, architekt, prawnik, doradca podatkowy

**Charakter:** autorytet + ekspertyza + dyskrecja. Targetuje longer consideration cycle.

**Layout:**
- Hero: subtelny, "Umów konsultację", form zapisu na konsultację
- Sekcje: O kancelarii (zespół z LinkedIn linkami), Specjalizacje, Case studies (anonimowe), Publikacje/blog, Wyróżnienia/Ranking, FAQ, Strefa klienta (opcjonalnie login)
- Schema: `Notary` / `LegalService` / `AccountingService` / `Architect` (subtyp wybierany)

**Warianty:** Classic Blue (granat głęboki + biały), Forest (zielony + beżowy), Burgundy (bordowy + kremowy), Slate (szary + biały), Gold Touch (granat + złoto)

**EEAT blocks:**
- Author bio dla każdego partnera/eksperta (zdjęcie, tytuły naukowe, doświadczenie, publikacje, LinkedIn)
- Credentials (uprawnienia, członkostwa, certyfikaty państwowe — wpisy na listach)
- Awards / Rankings

## B.3 `medical` — lekarz, dentysta, kosmetolog, fizjoterapeuta

**Charakter:** zaufanie + zdrowie + booking. Targetuje YMYL.

**Layout:**
- Hero: zdjęcie gabinetu + "Umów wizytę online" (Booksy embed lub ZnanyLekarz widget jeśli klient ma profil)
- Sekcje: Specjalizacje, Zespół (lekarze z bio), Cennik widoczny, Sprzęt, Wizyta krok po kroku, Opinie weryfikowane, FAQ medyczne, Lokalizacja + parking
- Schema: `MedicalBusiness` / `Dentist` / `Physiotherapy` / `BeautySalon` (medical aesthetics)

**Warianty:** Calm (turkus + biały), Clean (biały + miętowy), Trust (granat + biały), Premium (czarny + złoty), Soft (różowy + kremowy)

**EEAT blocks:**
- AuthorBox dla każdego lekarza z PWZ (Prawo Wykonywania Zawodu), specjalizacją, latami doświadczenia, link do ZnanyLekarz
- Certyfikaty + dyplomy
- Disclaimery medyczne (nie zastępuje konsultacji)

## B.4 `beauty` — salon urody, fryzjer, paznokcie, masaż

**Charakter:** wizualny + szybkie booking + społeczność.

**Layout:**
- Hero: galeria foto/wideo z realizacji + Booksy CTA
- Sekcje: Usługi z cennikiem, Galeria (Instagram-like grid), Zespół (stylistki z bio + Instagram), Promocje aktualne, Opinie z fotkami przed/po, FAQ, Lokalizacja
- Schema: `BeautySalon` / `HairSalon` / `NailSalon` / `SpaSalon`

**Warianty:** Rose Gold (różowy + złoty), Modern (czarny + biały + neon), Pastel (lawendowy + kremowy), Warm (terakota + kremowy), Glam (czerń + różowy)

**EEAT blocks:**
- AuthorBox dla każdej stylistki z portfolio link
- Certyfikaty kursy + szkolenia
- Instagram/TikTok feed embed

## B.5 `local-services` — sprzątanie, opieka, transport, drobne naprawy

**Charakter:** transparentność cennika + szybka decyzja + zasięg.

**Layout:**
- Hero: kalkulator wstępnej ceny (np. dla sprzątania: rodzaj + metraż → przybliżony koszt) + form zamówienia
- Sekcje: Pakiety/Cennik widoczny, Co wykonujemy / nie wykonujemy, Strefa działania, Proces, Opinie, FAQ, Kontakt
- Schema: `CleaningService` / `HomeAndConstructionBusiness` / `MovingCompany`

**Warianty:** Eco (zielony + biały), Trust (granat + pomarańcz), Clean (biały + niebieski), Bold (czerwony + czarny), Pastel (jasny niebieski + biały)

**EEAT blocks:**
- AuthorBox właściciela
- Ubezpieczenie OC działalności (jeśli posiada — ważny sygnał zaufania)
- Realizacje liczba + zdjęcia

## B.6 `food` (odroczone do fazy 8)

Restauracja, kawiarnia, catering — wymaga: menu z aktualizacją w CMS, rezerwacje (Resy / własny system), photo gallery, dietary attributes, geo lunch search.

## B.7 Wspólne dla wszystkich presetów

**Sticky elements:** górny pasek z telefonem + godziny otwarcia + "Otwarte/Zamknięte" badge (z config opening hours)

**Footer block:** NAP, godziny, mapa Google embed (lazy), social, NIP/REGON, link polityka prywatności, link DPA dla klientów (jeśli dotyczy)

**Mobile-first** — wszystko testowane na 360px viewport jako baseline

**Accessibility baseline (każdy preset):** kontrast ≥4.5:1, focus rings widoczne, keyboard navigation, screen reader landmarks

**Performance baseline (każdy preset):** LCP <1.5s na 3G fast, CLS <0.05, INP <100ms, JS budget <30KB pre-interaction

---
