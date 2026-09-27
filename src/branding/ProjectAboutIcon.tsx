import type { SVGProps } from "react";
import { PROJECT_BRAND_MARK_URL } from "./projectIdentity";

/** Shared launcher icon wrapper for the project About entry points. */
export function ProjectAboutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="About die Nische" {...props} data-icon-family="project-about">
      <image
        href={PROJECT_BRAND_MARK_URL}
        x="0"
        y="0"
        width="48"
        height="48"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
