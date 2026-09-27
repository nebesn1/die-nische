import { PROJECT_LEGAL_AFFILIATION } from "./projectLegal";

export const PROJECT_BRAND = "die Nische";
export const PROJECT_DESCRIPTION = "A KDE 3-inspired web desktop.";
export const PROJECT_INDEPENDENCE_NOTICE = `die Nische is an independent web desktop project inspired by the KDE 3 desktop environment. ${PROJECT_LEGAL_AFFILIATION.charAt(0).toLowerCase()}${PROJECT_LEGAL_AFFILIATION.slice(1)}`;
export const PROJECT_BRAND_MARK_PATH = "branding/die-nische-mark.svg";
export const PROJECT_BRAND_MARK_URL = `${import.meta.env.BASE_URL}${PROJECT_BRAND_MARK_PATH}`;
export const PROJECT_ABOUT_ICON_ID = "project-about";
