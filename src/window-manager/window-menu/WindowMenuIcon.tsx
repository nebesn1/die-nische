import type { SVGProps } from "react";

type WindowMenuIconProps = SVGProps<SVGSVGElement> & {
  iconId: string;
};

export function WindowMenuIcon({ iconId, ...props }: WindowMenuIconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter">
        {iconId === "minimize" ? <path d="M3 12h10" strokeWidth="2" /> : null}
        {iconId === "maximize" ? <rect x="3" y="3" width="10" height="10" strokeWidth="1.5" /> : null}
        {iconId === "close" ? <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" /> : null}
        {iconId === "desktop-grid" ? (
          <>
            <rect x="2.5" y="2.5" width="5" height="5" strokeWidth="1.2" />
            <rect x="8.5" y="2.5" width="5" height="5" strokeWidth="1.2" />
            <rect x="2.5" y="8.5" width="5" height="5" strokeWidth="1.2" />
            <rect x="8.5" y="8.5" width="5" height="5" strokeWidth="1.2" />
          </>
        ) : null}
      </g>
    </svg>
  );
}
