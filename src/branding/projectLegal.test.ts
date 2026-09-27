import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KDE_TRADEMARK_NOTICE,
  PROJECT_LEGAL_AFFILIATION,
  PROJECT_LEGAL_RECREATION_NOTICE,
  PROJECT_LEGAL_VFS_NOTICE,
} from "./projectLegal";
import { PROJECT_BRAND } from "./projectIdentity";

const legalDocument = readFileSync(new URL("../../LEGAL.md", import.meta.url), "utf8");
const normalizedLegalDocument = legalDocument.replace(/\s+/g, " ");
const trademarkSection = legalDocument.split("## Trademarks and Third-Party Names")[1]?.split("## die Nische Name and Project Mark")[0] ?? "";

describe("project legal identity", () => {
  it("keeps the independent die Nische identity and non-affiliation boundary", () => {
    expect(PROJECT_BRAND).toBe("die Nische");
    expect(PROJECT_LEGAL_AFFILIATION).toContain("KDE e.V.");
    expect(PROJECT_LEGAL_AFFILIATION).toContain("KDE Community");
    expect(PROJECT_LEGAL_AFFILIATION).toContain("Not affiliated");
    expect(normalizedLegalDocument).toContain("independent and unofficial project");
    expect(normalizedLegalDocument).toContain("not affiliated with, endorsed by, sponsored by");
  });

  it("limits the KDE trademark statement to the approved wording", () => {
    expect(KDE_TRADEMARK_NOTICE).toBe("KDE® and the K Desktop Environment® logo are registered trademarks of KDE e.V.");
    expect(normalizedLegalDocument).toContain(KDE_TRADEMARK_NOTICE);
    expect(trademarkSection).not.toMatch(/Konqueror.*registered trademark/i);
    expect(trademarkSection).not.toMatch(/Konsole.*registered trademark/i);
    expect(trademarkSection).not.toMatch(/KWrite.*registered trademark/i);
    expect(trademarkSection).not.toMatch(/KCalc.*registered trademark/i);
    expect(trademarkSection).not.toMatch(/KFind.*registered trademark/i);
  });

  it("distinguishes recreated applications and the simulated filesystem", () => {
    expect(PROJECT_LEGAL_RECREATION_NOTICE).toContain("browser-based recreations");
    expect(PROJECT_LEGAL_RECREATION_NOTICE).toContain("not the original KDE applications");
    expect(PROJECT_LEGAL_VFS_NOTICE).toContain("browser-based virtual/simulated filesystem");
    expect(PROJECT_LEGAL_VFS_NOTICE).toContain("unless a feature explicitly states otherwise");
    expect(normalizedLegalDocument).toContain("browser-based virtual/simulated filesystem");
  });
});
