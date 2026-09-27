import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function TrashIcon(props: IconProps) {
  const trashBodyId = `${useId()}-trashBody`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Trash" {...props}>
      <defs>
        <linearGradient id={trashBodyId} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#f8f8f8" offset="0" />
          <stop stopColor="#9fa9b2" offset="1" />
        </linearGradient>
      </defs>
      <path d="M15 15h22l-3 27H18z" fill={`url(#${trashBodyId})`} stroke="#3d4850" strokeWidth="2" />
      <path d="M13 13h26v5H13z" fill="#d7dde1" stroke="#3d4850" strokeWidth="2" />
      <path d="M20 10h12l2 3H18z" fill="#eef4f7" stroke="#3d4850" strokeWidth="2" />
      <path d="M21 20v16M26 20v16M31 20v16" stroke="#68727b" strokeWidth="2" />
      <path d="M17 16h16" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}

export function FullTrashIcon(props: IconProps) {
  const fullTrashBodyId = `${useId()}-fullTrashBody`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Trash" {...props}>
      <defs>
        <linearGradient id={fullTrashBodyId} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#f8f8f8" offset="0" />
          <stop stopColor="#9fa9b2" offset="1" />
        </linearGradient>
      </defs>
      <path d="M16 16h20l-3 26H19z" fill={`url(#${fullTrashBodyId})`} stroke="#3d4850" strokeWidth="2" />
      <path d="M18 18h16l-1 8H19z" fill="#f0c341" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M21 11h8l5 5H16z" fill="#dbe8f1" stroke="#3d4850" strokeWidth="1.4" />
      <path d="M13 13h26v5H13z" fill="#d7dde1" stroke="#3d4850" strokeWidth="2" />
      <path d="M20 10h12l2 3H18z" fill="#eef4f7" stroke="#3d4850" strokeWidth="2" />
      <path d="M22 26v10M27 26v10M32 26v10" stroke="#68727b" strokeWidth="2" />
      <path d="M17 16h16" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}

export function DiscIcon(props: IconProps) {
  const discShineId = `${useId()}-discShine`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="CD/DVD-ROM Device" {...props}>
      <defs>
        <radialGradient id={discShineId} cx="35%" cy="28%" r="72%">
          <stop stopColor="#ffffff" offset="0" />
          <stop stopColor="#dbeefe" offset="0.28" />
          <stop stopColor="#7a91c9" offset="0.62" />
          <stop stopColor="#dce6f6" offset="1" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill={`url(#${discShineId})`} stroke="#2f3e7e" strokeWidth="2" />
      <circle cx="24" cy="24" r="5" fill="#ffffff" stroke="#51669a" strokeWidth="2" />
      <path d="M10 25c9-4 18-4 28 0M24 6c2 9 2 21 0 36" stroke="#ffffff" strokeWidth="2" opacity="0.45" />
      <path d="M31 32l9 8" stroke="#49bb51" strokeWidth="4" />
    </svg>
  );
}

export function FloppyIcon(props: IconProps) {
  const floppyFaceId = `${useId()}-floppyFace`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Floppy Device" {...props}>
      <defs>
        <linearGradient id={floppyFaceId} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#eef3f7" offset="0" />
          <stop stopColor="#7f8a96" offset="1" />
        </linearGradient>
      </defs>
      <path d="M9 8h26l4 5v27H9z" fill={`url(#${floppyFaceId})`} stroke="#25313b" strokeWidth="2" />
      <path d="M14 10h18v12H14z" fill="#2b3a4a" />
      <path d="M18 11h10v8H18z" fill="#cfd8df" />
      <path d="M15 28h18v12H15z" fill="#edf2f4" stroke="#66717a" />
      <path d="M18 32h12M18 36h10" stroke="#73808a" strokeWidth="2" />
      <path d="M32 31l8 8" stroke="#59bd62" strokeWidth="4" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  const homeWallId = `${useId()}-homeWall`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Home" {...props}>
      <defs>
        <linearGradient id={homeWallId} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#ffffff" offset="0" />
          <stop stopColor="#b7d3e6" offset="1" />
        </linearGradient>
      </defs>
      <path d="M8 25L24 10l16 15" fill="#e1793e" stroke="#4b2e20" strokeWidth="2" />
      <path d="M12 23v17h24V23L24 13z" fill={`url(#${homeWallId})`} stroke="#344c5b" strokeWidth="2" />
      <path d="M20 40V28h8v12" fill="#87552e" stroke="#4b2e20" strokeWidth="2" />
      <path d="M30 29h4v5h-4zM14 29h4v5h-4z" fill="#65a7df" stroke="#356d9c" />
      <path d="M14 23l10-9 10 9" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

export function HomeOpenIcon(props: IconProps) {
  const homeOpenWallId = `${useId()}-homeOpenWall`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Home" {...props}>
      <defs>
        <linearGradient id={homeOpenWallId} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#ffffff" offset="0" />
          <stop stopColor="#b7d3e6" offset="1" />
        </linearGradient>
      </defs>
      <path d="M8 25L24 10l16 15" fill="#e1793e" stroke="#4b2e20" strokeWidth="2" />
      <path d="M12 23v17h24V23L24 13z" fill={`url(#${homeOpenWallId})`} stroke="#344c5b" strokeWidth="2" />
      <path d="M20 40V28h8v12" fill="#26313a" stroke="#4b2e20" strokeWidth="2" />
      <path d="M28 28l7 4v10l-7-2z" fill="#b87a3e" stroke="#4b2e20" strokeWidth="1.5" />
      <path d="M30 29h4v5h-4zM14 29h4v5h-4z" fill="#65a7df" stroke="#356d9c" />
      <path d="M14 23l10-9 10 9" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

export function MyComputerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="My Computer" {...props}>
      <rect x="8" y="8" width="32" height="24" fill="#dce5ea" stroke="#31434e" strokeWidth="2" />
      <rect x="11" y="11" width="26" height="17" fill="#559bd2" stroke="#284c66" strokeWidth="1.5" />
      <path d="M18 36h12M24 32v4M14 40h20" fill="none" stroke="#31434e" strokeWidth="2" />
      <path d="M14 14h20" stroke="#c9efff" strokeWidth="2" opacity="0.75" />
      <rect x="11" y="38" width="26" height="4" fill="#b4bec5" stroke="#31434e" strokeWidth="1.5" />
    </svg>
  );
}

export function KonquerorIcon(props: IconProps) {
  const globeGradientId = useId();

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Konqueror" {...props}>
      <defs>
        <radialGradient id={globeGradientId} cx="35%" cy="30%" r="65%">
          <stop stopColor="#bdf4ff" offset="0" />
          <stop stopColor="#358bd0" offset="0.55" />
          <stop stopColor="#145083" offset="1" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="14" fill={`url(#${globeGradientId})`} stroke="#1d3953" strokeWidth="2" />
      <path d="M13 24h22M24 10c-5 7-5 21 0 28M24 10c5 7 5 21 0 28" stroke="#d6fbff" strokeWidth="1.5" opacity="0.8" />
      <path d="M12 38l24-28M10 10l28 28" stroke="#d8dde0" strokeWidth="4" strokeLinecap="round" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="#1d3953" strokeWidth="2" />
    </svg>
  );
}

export function KonquerorOpenIcon(props: IconProps) {
  const globeGradientId = useId();

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Konqueror" {...props}>
      <defs>
        <radialGradient id={globeGradientId} cx="35%" cy="30%" r="65%">
          <stop stopColor="#bdf4ff" offset="0" />
          <stop stopColor="#358bd0" offset="0.55" />
          <stop stopColor="#145083" offset="1" />
        </radialGradient>
      </defs>
      <path d="M8 8h23v20H8z" fill="#d9e2e6" stroke="#1d3953" strokeWidth="2" />
      <path d="M10 10h19v4H10z" fill="#2b77b4" />
      <path d="M11 16h17v10H11z" fill="#f7f8f2" />
      <circle cx="27" cy="27" r="13" fill={`url(#${globeGradientId})`} stroke="#1d3953" strokeWidth="2" />
      <path d="M17 27h20M27 14c-5 7-5 19 0 26M27 14c5 7 5 19 0 26" stroke="#d6fbff" strokeWidth="1.5" opacity="0.8" />
      <path d="M17 40l20-26M15 14l24 24" stroke="#d8dde0" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="27" cy="27" r="13" fill="none" stroke="#1d3953" strokeWidth="2" />
    </svg>
  );
}

export function KonsoleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Konsole" {...props}>
      <path d="M8 11h32v26H8z" fill="#26313a" stroke="#111820" strokeWidth="2" />
      <path d="M10 13h28v4H10z" fill="#eef1f3" />
      <path d="M14 24l6 5-6 5M23 34h11" fill="none" stroke="#90f08f" strokeWidth="3" strokeLinecap="square" />
      <path d="M12 15h16" stroke="#ffffff" strokeWidth="1" />
    </svg>
  );
}

export function KCalcIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="KCalc" {...props}>
      <rect x="9" y="5" width="30" height="38" fill="#b9c1c7" stroke="#38434b" strokeWidth="2" />
      <rect x="13" y="9" width="22" height="9" fill="#dce8c8" stroke="#56664a" strokeWidth="1.5" />
      <path d="M15 14h16" stroke="#60734f" strokeWidth="1.5" />
      <g fill="#e9e6dd" stroke="#55544f" strokeWidth="1.2">
        <rect x="13" y="22" width="5" height="5" />
        <rect x="21.5" y="22" width="5" height="5" />
        <rect x="30" y="22" width="5" height="5" />
        <rect x="13" y="30" width="5" height="5" />
        <rect x="21.5" y="30" width="5" height="5" />
        <rect x="30" y="30" width="5" height="5" />
      </g>
      <path d="M15 24.5h1.5M23 24.5h2M31.2 24.5h2.5M14.5 32.5h2.5M23.8 30.8v3.4M22.1 32.5h3.4M31.2 32.5h2.5" stroke="#26323a" strokeWidth="1.2" />
    </svg>
  );
}

export function KWriteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="KWrite" {...props}>
      <path d="M10 5h22l7 7v31H10z" fill="#f4f1dc" stroke="#49535b" strokeWidth="2" />
      <path d="M32 5v8h7" fill="#d9e1e5" stroke="#49535b" strokeWidth="2" />
      <path d="M15 18h17M15 23h17M15 28h11" stroke="#5c6a73" strokeWidth="2" />
      <path d="M25 36l11-11 4 4-11 11-6 1z" fill="#f0c341" stroke="#684d12" strokeWidth="1.5" />
      <path d="M34 27l3 3" stroke="#ffffff" strokeWidth="1.2" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Calendar" {...props}>
      <rect x="8" y="9" width="32" height="31" fill="#f4f1dc" stroke="#34434d" strokeWidth="2" />
      <path d="M8 17h32v7H8z" fill="#3f7fb0" stroke="#34434d" strokeWidth="1.5" />
      <path d="M16 6v8M32 6v8" stroke="#3b4348" strokeWidth="3" />
      <path d="M14 28h5M22 28h5M30 28h5M14 34h5M22 34h5M30 34h5" stroke="#607480" strokeWidth="2" />
      <rect x="21" y="25" width="7" height="7" fill="#e2b640" stroke="#71520e" strokeWidth="1.2" />
      <path d="M10 11h28" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

export function ShowDesktopIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Show Desktop" {...props}>
      <path d="M8 13h32v23H8z" fill="#3d93d2" stroke="#1d3c5a" strokeWidth="2" />
      <path d="M11 16h26v17H11z" fill="#a8d3ef" />
      <path d="M8 36h32l-4 5H12z" fill="#8d969d" stroke="#1d3c5a" strokeWidth="2" />
      <path d="M15 22h18M15 27h14" stroke="#ffffff" strokeWidth="2" opacity="0.75" />
    </svg>
  );
}

export function PanelSettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Configure the Panel" {...props}>
      <rect x="5" y="10" width="38" height="10" fill="#3e86b7" stroke="#1e3e58" strokeWidth="2" />
      <rect x="5" y="30" width="38" height="8" fill="#b9c2c8" stroke="#46535d" strokeWidth="2" />
      <path d="M11 15h26M11 34h26" stroke="#dff5ff" strokeWidth="2" />
      <circle cx="17" cy="25" r="5" fill="#f0c341" stroke="#684d12" strokeWidth="2" />
      <path d="M17 21v8M13 25h8" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

export function KMenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="K Menu" data-icon-family="k-menu" {...props}>
      <rect x="6" y="7" width="36" height="34" rx="2" fill="#d6e0e5" stroke="#263b4b" strokeWidth="2" />
      <rect x="10" y="11" width="28" height="7" fill="#397e9b" stroke="#204d5c" />
      <path d="M12 25h24M12 33h24" stroke="#55707e" strokeWidth="2" />
      <rect x="12" y="21" width="5" height="5" fill="#d59b3e" stroke="#684d12" />
      <rect x="20" y="21" width="5" height="5" fill="#5c9fca" stroke="#285b78" />
      <rect x="28" y="21" width="5" height="5" fill="#76ad69" stroke="#385a32" />
      <path d="M11 13h26" stroke="#eaf7ff" strokeWidth="2" opacity="0.8" />
    </svg>
  );
}

export function TrayLockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Locked" {...props}>
      <rect x="5" y="10" width="14" height="10" fill="#f2b33d" stroke="#553b12" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#f8f8f8" strokeWidth="2" />
      <path d="M12 13v4" stroke="#553b12" strokeWidth="2" />
    </svg>
  );
}

export function TrayNetworkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Network" {...props}>
      <rect x="3" y="4" width="8" height="7" fill="#77b9e8" stroke="#1f4664" />
      <rect x="13" y="13" width="8" height="7" fill="#77b9e8" stroke="#1f4664" />
      <path d="M7 11v4h10" fill="none" stroke="#1f4664" strokeWidth="2" />
      <path d="M5 6h4M15 15h4" stroke="#ffffff" />
    </svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label="Clipboard" {...props}><rect x="6" y="4" width="12" height="16" fill="#f1eee8" stroke="#4b4b48"/><rect x="9" y="2" width="6" height="4" fill="#85b8dd" stroke="#31536b"/><path d="M9 10h6M9 14h6M9 17h4" stroke="#31536b" strokeWidth="1.5"/></svg>;
}

export function EndSessionIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label="End Session" {...props}><path d="M12 3v9" stroke="#9d1e1e" strokeWidth="2.5"/><path d="M7 5.8a8 8 0 1 0 10 0" fill="none" stroke="#9d1e1e" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="#e4aa42"/></svg>;
}

export function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Bookmark" {...props}>
      <path d="M24 5l5 13 14 1-11 9 4 14-12-8-12 8 4-14-11-9 14-1z" fill="#f0c341" stroke="#6a4f10" strokeWidth="2" />
      <path d="M21 12l3-6 3 12" stroke="#fff6b3" strokeWidth="2" opacity="0.85" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Settings" {...props}>
      <path d="M21 5h6l2 7 6-3 4 4-3 6 7 2v6l-7 2 3 6-4 4-6-3-2 7h-6l-2-7-6 3-4-4 3-6-7-2v-6l7-2-3-6 4-4 6 3z" fill="#c8d0d5" stroke="#3c444a" strokeWidth="2" />
      <circle cx="24" cy="24" r="7" fill="#559bd2" stroke="#263b4b" strokeWidth="2" />
    </svg>
  );
}
