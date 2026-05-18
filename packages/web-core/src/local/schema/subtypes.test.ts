import { describe, expect, it } from "vitest";

import { getSubtypeMeta, getSubtypesForPreset, presetForSubtype } from "./subtypes.js";
import { LOCAL_BUSINESS_SUBTYPES } from "./types.js";

describe("subtype metadata", () => {
  it("has metadata for all 16 subtypes", () => {
    for (const t of LOCAL_BUSINESS_SUBTYPES) {
      const meta = getSubtypeMeta(t);
      expect(meta.type).toBe(t);
      expect(meta.labelPl).toBeTruthy();
      expect(meta.labelEn).toBeTruthy();
      expect(meta.themePreset).toBeTruthy();
    }
  });

  it("maps subtype to expected preset", () => {
    expect(presetForSubtype("Locksmith")).toBe("craftsman");
    expect(presetForSubtype("AutoRepair")).toBe("craftsman");
    expect(presetForSubtype("Plumber")).toBe("craftsman");
    expect(presetForSubtype("Electrician")).toBe("craftsman");
    expect(presetForSubtype("AccountingService")).toBe("professional");
    expect(presetForSubtype("Notary")).toBe("professional");
    expect(presetForSubtype("MedicalBusiness")).toBe("medical");
    expect(presetForSubtype("BeautySalon")).toBe("beauty");
    expect(presetForSubtype("HairSalon")).toBe("beauty");
    expect(presetForSubtype("Restaurant")).toBe("food");
    expect(presetForSubtype("MovingCompany")).toBe("local-services");
    expect(presetForSubtype("ChildCare")).toBe("local-services");
    expect(presetForSubtype("LocalBusiness")).toBe("generic");
  });

  it("getSubtypesForPreset returns expected counts", () => {
    expect(getSubtypesForPreset("craftsman")).toHaveLength(4); // Locksmith, AutoRepair, Plumber, Electrician
    expect(getSubtypesForPreset("professional")).toHaveLength(5);
    expect(getSubtypesForPreset("medical")).toHaveLength(1);
    expect(getSubtypesForPreset("beauty")).toHaveLength(2);
    expect(getSubtypesForPreset("food")).toHaveLength(1);
    expect(getSubtypesForPreset("local-services")).toHaveLength(2);
    expect(getSubtypesForPreset("generic")).toHaveLength(1);
  });
});
