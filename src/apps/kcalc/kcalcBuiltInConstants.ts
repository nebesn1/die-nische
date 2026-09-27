export type KCalcBuiltInConstantCategoryId =
  | "mathematics"
  | "electromagnetism"
  | "atomic-nuclear"
  | "thermodynamics"
  | "gravitation";

export type KCalcBuiltInConstant = Readonly<{
  id: string;
  label: string;
  canonicalValue: string;
  value: Readonly<{ kind: "number"; value: number }>;
}>;

export type KCalcBuiltInConstantCategory = Readonly<{
  id: KCalcBuiltInConstantCategoryId;
  label: string;
  constants: readonly KCalcBuiltInConstant[];
}>;

const constant = (id: string, label: string, canonicalValue: string): KCalcBuiltInConstant => {
  const value = Number(canonicalValue);

  if (!Number.isFinite(value)) {
    throw new Error(`KCalc built-in constant must be finite: ${id}`);
  }

  return { id, label, canonicalValue, value: { kind: "number", value } };
};

// KDE 3.5.9 kcalc_const_menu.cpp source order and source-era precision.
const pi = constant("pi", "Pi", "3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117068");
const eulerNumber = constant("euler-number", "Euler Number", "2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217825166427");
const goldenRatio = constant("golden-ratio", "Golden Ratio", "1.61803398874989484820458683436563811");
const lightSpeed = constant("light-speed", "Light Speed", "2.99792458e8");
const plancksConstant = constant("plancks-constant", "Planck's Constant", "6.6260693e-34");
const gravitation = constant("constant-of-gravitation", "Constant of Gravitation", "6.6742e-11");
const earthAcceleration = constant("earth-acceleration", "Earth Acceleration", "9.80665");
const elementaryCharge = constant("elementary-charge", "Elementary Charge", "1.60217653e-19");
const impedanceOfVacuum = constant("impedance-of-vacuum", "Impedance of Vacuum", "376.730313461");
const fineStructure = constant("fine-structure-constant", "Fine-Structure Constant", "7.297352568e-3");
const permeability = constant("permeability-of-vacuum", "Permeability of Vacuum", "1.2566370614e-6");
const permittivity = constant("permittivity-of-vacuum", "Permittivity of vacuum", "8.854187817e-12");
const boltzmann = constant("boltzmann-constant", "Boltzmann Constant", "1.3806505e-23");
const atomicMassUnit = constant("atomic-mass-unit", "Atomic Mass Unit", "1.66053886e-27");
const molarGas = constant("molar-gas-constant", "Molar Gas Constant", "8.314472");
const stefanBoltzmann = constant("stefan-boltzmann-constant", "Stefan-Boltzmann Constant", "5.670400e-8");
const avogadro = constant("avogadros-number", "Avogadro's Number", "6.0221415e23");

export const kcalcBuiltInConstantCategories = Object.freeze([
  { id: "mathematics", label: "Mathematics", constants: [pi, eulerNumber, goldenRatio] },
  { id: "electromagnetism", label: "Electromagnetism", constants: [lightSpeed, elementaryCharge, impedanceOfVacuum, permeability, permittivity] },
  { id: "atomic-nuclear", label: "Atomic & Nuclear", constants: [plancksConstant, elementaryCharge, fineStructure] },
  { id: "thermodynamics", label: "Thermodynamics", constants: [boltzmann, atomicMassUnit, molarGas, stefanBoltzmann, avogadro] },
  { id: "gravitation", label: "Gravitation", constants: [gravitation, earthAcceleration] },
] as const satisfies readonly KCalcBuiltInConstantCategory[]);

export const kcalcBuiltInConstants = Object.freeze([
  pi,
  eulerNumber,
  goldenRatio,
  lightSpeed,
  plancksConstant,
  gravitation,
  earthAcceleration,
  elementaryCharge,
  impedanceOfVacuum,
  fineStructure,
  permeability,
  permittivity,
  boltzmann,
  atomicMassUnit,
  molarGas,
  stefanBoltzmann,
  avogadro,
] as const satisfies readonly KCalcBuiltInConstant[]);

export const getKCalcBuiltInConstant = (id: string): KCalcBuiltInConstant | null =>
  kcalcBuiltInConstants.find((constant) => constant.id === id) ?? null;
