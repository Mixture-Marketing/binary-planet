# mm-marketing

Publiczny landing dla MixtureMarketing — sales funnel + wizard onboardingu.

**Status:** placeholder. Może być sekcją głównej strony `mixturemarketing.pl` LUB osobnym deploy (subdomena `lokalne-strony.mixturemarketing.pl`).

Patrz [plan/00-main.md "Faza 3"](../../plan/00-main.md) (onboarding wizard 12 kroków) i [plan/C-onboarding-wizard.md](../../plan/C-onboarding-wizard.md).

Co tu będzie:
- Landing publiczna z cennikiem 3 tierów (Starter 149 / Standard 199 / Premium 299)
- Wizard step-by-step (12 kroków):
  1. Wybierz branżę → sugestia theme preset
  2. Wariant kolorystyczny (3-5 wariantów, live preview)
  3. NIP → REGON autofetch
  4. Potwierdź/edytuj dane firmy + GBP Place ID
  5. Lista usług (z presetu, edytowalna, max 8)
  6. Service area
  7. Godziny otwarcia
  8. Upload logo + zdjęcia (lub AI generation)
  9. AI generuje treść → klient widzi, edytuje, akceptuje
  10. Wybór tieru + modelu płatności
  11. Płatność: Stripe (karty, SEPA, PayPal) + Przelewy24 (BLIK, przelewy PL)
  12. Confirmation + DNS instructions
