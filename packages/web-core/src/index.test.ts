import { describe, expect, it } from "vitest";

import { WEB_CORE_VERSION } from "./index.js";
import { MODULE_NAME as A11Y } from "./a11y/index.js";
import { MODULE_NAME as ADS } from "./ads/index.js";
import { MODULE_NAME as CONSENT } from "./consent/index.js";
import { MODULE_NAME as FEATURE_FLAGS } from "./feature-flags/index.js";
import { MODULE_NAME as FORMS } from "./forms/index.js";
import { MODULE_NAME as LOCAL } from "./local/index.js";
import { MODULE_NAME as PROGRAMMATIC } from "./programmatic/index.js";
import { MODULE_NAME as REGON } from "./regon/index.js";
import { MODULE_NAME as SECURITY } from "./security/index.js";
import { MODULE_NAME as SEO } from "./seo/index.js";
import { MODULE_NAME as ZARAZ } from "./zaraz/index.js";

describe("web-core skeleton", () => {
  it("exports version", () => {
    expect(WEB_CORE_VERSION).toBe("0.0.1");
  });

  it("loads all 11 modules", () => {
    const modules = [
      SEO,
      LOCAL,
      FORMS,
      A11Y,
      SECURITY,
      FEATURE_FLAGS,
      REGON,
      PROGRAMMATIC,
      CONSENT,
      ZARAZ,
      ADS,
    ];
    expect(modules).toHaveLength(11);
    expect(new Set(modules).size).toBe(11);
  });
});
