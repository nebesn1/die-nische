import { describe, expect, it } from "vitest";
import { kcalcBuiltInConstantCategories, kcalcBuiltInConstants } from "./kcalcBuiltInConstants";

describe("KDE 3.5.9 built-in constants catalog", () => {
  it("keeps the five source-order categories and all seventeen source definitions", () => {
    expect(kcalcBuiltInConstantCategories.map(({ id, label }) => [id, label])).toEqual([
      ["mathematics", "Mathematics"],
      ["electromagnetism", "Electromagnetism"],
      ["atomic-nuclear", "Atomic & Nuclear"],
      ["thermodynamics", "Thermodynamics"],
      ["gravitation", "Gravitation"],
    ]);
    expect(kcalcBuiltInConstants).toHaveLength(17);
    expect(kcalcBuiltInConstants.map(({ label, canonicalValue }) => [label, canonicalValue])).toEqual([
      ["Pi", "3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117068"],
      ["Euler Number", "2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217825166427"],
      ["Golden Ratio", "1.61803398874989484820458683436563811"],
      ["Light Speed", "2.99792458e8"],
      ["Planck's Constant", "6.6260693e-34"],
      ["Constant of Gravitation", "6.6742e-11"],
      ["Earth Acceleration", "9.80665"],
      ["Elementary Charge", "1.60217653e-19"],
      ["Impedance of Vacuum", "376.730313461"],
      ["Fine-Structure Constant", "7.297352568e-3"],
      ["Permeability of Vacuum", "1.2566370614e-6"],
      ["Permittivity of vacuum", "8.854187817e-12"],
      ["Boltzmann Constant", "1.3806505e-23"],
      ["Atomic Mass Unit", "1.66053886e-27"],
      ["Molar Gas Constant", "8.314472"],
      ["Stefan-Boltzmann Constant", "5.670400e-8"],
      ["Avogadro's Number", "6.0221415e23"],
    ]);
  });

  it("retains the historical Elementary Charge category duplicate without adding a second definition", () => {
    expect(kcalcBuiltInConstantCategories.flatMap((category) => category.constants).filter(({ id }) => id === "elementary-charge")).toHaveLength(2);
    expect(kcalcBuiltInConstantCategories.map((category) => category.constants.length)).toEqual([3, 5, 3, 5, 2]);
  });
});
