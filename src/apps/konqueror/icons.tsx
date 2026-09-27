import type { ReactNode, SVGProps } from "react";
import { DiscIcon, FloppyIcon, HomeIcon, TrashIcon } from "../../icons/IconComponents";
import type { KonquerorNodeIconId } from "./nodePresentation";

type IconProps = SVGProps<SVGSVGElement>;

export function BackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Back" {...props}>
      <path d="M10 5L3 12l7 7v-4h10V9H10z" fill="#4a8bc5" stroke="#173b5f" strokeWidth="1.5" />
      <path d="M9 8l-4 4 4 4" fill="none" stroke="#eaf7ff" strokeWidth="1.5" />
    </svg>
  );
}

export function ForwardIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Forward" {...props}>
      <path d="M14 5l7 7-7 7v-4H4V9h10z" fill="#4a8bc5" stroke="#173b5f" strokeWidth="1.5" />
      <path d="M15 8l4 4-4 4" fill="none" stroke="#eaf7ff" strokeWidth="1.5" />
    </svg>
  );
}

export function UpIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Up" {...props}>
      <path d="M12 3l7 7h-4v11H9V10H5z" fill="#50a25a" stroke="#21552a" strokeWidth="1.5" />
      <path d="M12 5l-4 4h3" fill="none" stroke="#edf8ee" strokeWidth="1.5" />
    </svg>
  );
}

export function ReloadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Reload" {...props}>
      <path d="M18 8a7 7 0 1 0 1 6" fill="none" stroke="#315f96" strokeWidth="2.5" />
      <path d="M18 3v6h-6" fill="#7db4df" stroke="#315f96" strokeWidth="1.5" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Stop" {...props}>
      <rect x="5" y="5" width="14" height="14" fill="#c84848" stroke="#702525" strokeWidth="1.5" />
      <path d="M8 8h8v8H8z" fill="#f8d7d7" opacity="0.55" />
    </svg>
  );
}

export function PrintIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Print" {...props}>
      <path d="M6 3h12v6H6z" fill="#eef2f5" stroke="#4e5d67" strokeWidth="1.2" />
      <path d="M4 9h16v8H4z" fill="#7993a8" stroke="#40515d" strokeWidth="1.2" />
      <path d="M7 14h10v7H7z" fill="#fbfbfb" stroke="#4e5d67" strokeWidth="1.2" />
      <path d="M16 11h2" stroke="#f8f8f8" strokeWidth="1.4" />
    </svg>
  );
}

export function ZoomInIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Zoom In" {...props}>
      <circle cx="10" cy="10" r="6" fill="#d8eaf7" stroke="#315f96" strokeWidth="1.5" />
      <path d="M10 7v6M7 10h6M14.5 14.5L20 20" fill="none" stroke="#315f96" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FindIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Find" {...props}>
      <circle cx="10" cy="10" r="6" fill="#d8eaf7" stroke="#315f96" strokeWidth="1.5" />
      <path d="M14.5 14.5L20 20" fill="none" stroke="#315f96" strokeWidth="1.7" />
      <path d="M7.5 10h5" stroke="#f8f8f8" strokeWidth="1.2" opacity="0.85" />
    </svg>
  );
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Zoom Out" {...props}>
      <circle cx="10" cy="10" r="6" fill="#d8eaf7" stroke="#315f96" strokeWidth="1.5" />
      <path d="M7 10h6M14.5 14.5L20 20" fill="none" stroke="#315f96" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function RotateRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Rotate Right" {...props}>
      <path d="M18 8a7 7 0 1 0 1 6" fill="none" stroke="#315f96" strokeWidth="2" />
      <path d="M18 4v5h-5" fill="none" stroke="#315f96" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v4l3 2" fill="none" stroke="#e9c85b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconViewIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Icon View" {...props}>
      <rect x="4" y="4" width="6" height="6" fill="#e9c85b" stroke="#7a5a14" />
      <rect x="14" y="4" width="6" height="6" fill="#77b9e8" stroke="#315f96" />
      <rect x="4" y="14" width="6" height="6" fill="#77b9e8" stroke="#315f96" />
      <rect x="14" y="14" width="6" height="6" fill="#e9c85b" stroke="#7a5a14" />
    </svg>
  );
}

export function TreeViewIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Tree View" {...props}>
      <path d="M6 5v14M6 9h5M6 16h5" fill="none" stroke="#38596f" strokeWidth="1.5" />
      <rect x="11" y="6" width="8" height="5" fill="#e9c85b" stroke="#7a5a14" />
      <rect x="11" y="14" width="8" height="5" fill="#77b9e8" stroke="#315f96" />
    </svg>
  );
}

export function SecurityIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Security" {...props}>
      <path d="M6 10V7a6 6 0 0 1 12 0v3" fill="none" stroke="#315f96" strokeWidth="2" />
      <rect x="4" y="10" width="16" height="10" rx="1" fill="#d8eaf7" stroke="#315f96" strokeWidth="1.4" />
      <path d="M12 14v3" stroke="#315f96" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NewFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="New folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M2 9h20v3H2z" fill="#f6dc7b" />
      <path d="M13 12v6M10 15h6" stroke="#2f6f35" strokeWidth="1.8" />
    </svg>
  );
}

export function NewTextFileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="New text file" {...props}>
      <path d="M5 2h10l4 4v16H5z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.3" />
      <path d="M15 2v5h4" fill="#d8e8f7" stroke="#555d64" strokeWidth="1.1" />
      <path d="M8 11h8M8 14h6" stroke="#4e667a" strokeWidth="1.2" />
      <path d="M16 14v6M13 17h6" stroke="#2f6f35" strokeWidth="1.7" />
    </svg>
  );
}

export function RenameIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Rename" {...props}>
      <path d="M4 17l1 3 3-1 10-10-4-4z" fill="#f0c341" stroke="#6a4f10" strokeWidth="1.2" />
      <path d="M13 6l4 4" stroke="#fff6b3" strokeWidth="1.4" />
      <path d="M4 4h9M4 8h6" stroke="#456071" strokeWidth="1.5" />
    </svg>
  );
}

export function PropertiesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Properties" {...props}>
      <path d="M5 2h10l4 4v16H5z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.3" />
      <path d="M15 2v5h4" fill="#d8e8f7" stroke="#555d64" strokeWidth="1.1" />
      <circle cx="11" cy="13" r="3.2" fill="#77b9e8" stroke="#315f96" strokeWidth="1.2" />
      <path d="M11 11.5v.2M11 13v2" stroke="#173b5f" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Cut" {...props}>
      <circle cx="7" cy="17" r="3" fill="#f8f8f8" stroke="#394955" strokeWidth="1.3" />
      <circle cx="17" cy="17" r="3" fill="#f8f8f8" stroke="#394955" strokeWidth="1.3" />
      <path d="M8.8 14.6L17 5M15.2 14.6L7 5" stroke="#394955" strokeWidth="1.5" />
      <path d="M10 11l4 2" stroke="#b32929" strokeWidth="1.6" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Copy" {...props}>
      <path d="M7 3h10v14H7z" fill="#dce8f5" stroke="#3c5f7a" strokeWidth="1.2" />
      <path d="M4 7h10v14H4z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.2" />
      <path d="M7 11h5M7 14h4" stroke="#4e667a" strokeWidth="1.1" />
    </svg>
  );
}

export function PasteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Paste" {...props}>
      <path d="M7 5h10v16H7z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.2" />
      <path d="M9 3h6v4H9z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.1" />
      <path d="M10 12h4M10 15h5" stroke="#4e667a" strokeWidth="1.1" />
    </svg>
  );
}

export function MoveToTrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Move to Trash" {...props}>
      <path d="M8 8h9l-1 13H9z" fill="#d8dee3" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M7 6h11M10 6l1-2h3l1 2" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M4 14h5M7 11l-3 3 3 3" fill="none" stroke="#2d70a8" strokeWidth="1.6" />
    </svg>
  );
}

export function RestoreFromTrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Restore" {...props}>
      <path d="M8 8h9l-1 12H9z" fill="#d8dee3" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M7 6h11M10 6l1-2h3l1 2" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M13 15H5M8 12l-3 3 3 3" fill="none" stroke="#2f6f35" strokeWidth="1.6" />
    </svg>
  );
}

export function DeletePermanentlyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Delete permanently" {...props}>
      <path d="M8 8h9l-1 13H9z" fill="#d8dee3" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M7 6h11M10 6l1-2h3l1 2" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M8 12l8 8M16 12l-8 8" stroke="#a52222" strokeWidth="1.7" />
    </svg>
  );
}

export function EmptyTrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Empty Trash" {...props}>
      <path d="M8 8h9l-1 13H9z" fill="#d8dee3" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M7 6h11M10 6l1-2h3l1 2" stroke="#4d5a62" strokeWidth="1.2" />
      <path d="M11 13h4M10 16h6" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Edit" {...props}>
      <path d="M4 18h7l9-9-5-5-9 9z" fill="#f0c341" stroke="#6a4f10" strokeWidth="1.2" />
      <path d="M14 5l5 5" stroke="#fff6b3" strokeWidth="1.3" />
      <path d="M4 18l-1 3 3-1" fill="#d58b4d" stroke="#6a4f10" strokeWidth="1.1" />
    </svg>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Save" {...props}>
      <path d="M4 3h14l2 2v16H4z" fill="#3f78b7" stroke="#1e3f66" strokeWidth="1.3" />
      <path d="M7 3h8v6H7z" fill="#d9d9d9" stroke="#1e3f66" strokeWidth="1" />
      <path d="M7 14h10v7H7z" fill="#f8f8f8" stroke="#1e3f66" strokeWidth="1" />
      <path d="M9 17h6" stroke="#52606a" strokeWidth="1.2" />
    </svg>
  );
}

export function DiscardChangesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Discard changes" {...props}>
      <path d="M5 5h12l2 2v12H5z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.3" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="#a52222" strokeWidth="2" />
    </svg>
  );
}

export function GoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Go" {...props}>
      <path d="M4 5h9l7 7-7 7H4l7-7z" fill="#5ba55f" stroke="#244e28" strokeWidth="1.5" />
      <path d="M10 8l4 4-4 4" fill="none" stroke="#f4fff2" strokeWidth="2" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M2 9h20v3H2z" fill="#f6dc7b" />
      <path d="M3 8h8" stroke="#fff2a8" strokeWidth="1" />
    </svg>
  );
}

export function TextFileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Text file" {...props}>
      <path d="M5 2h10l4 4v16H5z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.3" />
      <path d="M15 2v5h4" fill="#d8e8f7" stroke="#555d64" strokeWidth="1.1" />
      <path d="M8 10h8M8 13h8M8 16h6" stroke="#4e667a" strokeWidth="1.2" />
    </svg>
  );
}

function FilePaper({ label, children, ...props }: IconProps & { readonly label: string; readonly children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} {...props}>
      <path d="M5 2h10l4 4v16H5z" fill="#f8f8f8" stroke="#555d64" strokeWidth="1.3" />
      <path d="M15 2v5h4" fill="#d8e8f7" stroke="#555d64" strokeWidth="1.1" />
      {children}
    </svg>
  );
}

export function MarkdownFileIcon(props: IconProps) {
  return (
    <FilePaper label="Markdown file" {...props}>
      <text x="7" y="17" fill="#315f96" fontSize="7" fontWeight="700">MD</text>
      <path d="M7 19h10" stroke="#e0b640" strokeWidth="1.4" />
    </FilePaper>
  );
}

export function HtmlFileIcon(props: IconProps) {
  return (
    <FilePaper label="HTML file" {...props}>
      <path d="M10 11l-3 3 3 3M14 11l3 3-3 3M13 10l-2 8" fill="none" stroke="#b15a32" strokeWidth="1.4" strokeLinecap="square" />
    </FilePaper>
  );
}

export function ImageFileIcon(props: IconProps) {
  return (
    <FilePaper label="Image file" {...props}>
      <rect x="7" y="10" width="10" height="8" fill="#d8eaf7" stroke="#315f96" strokeWidth="1" />
      <circle cx="14.5" cy="12.5" r="1.2" fill="#e0b640" stroke="#7a5a14" strokeWidth="0.6" />
      <path d="M8 17l3-3 2 2 1.5-1.5L17 17z" fill="#5cab66" stroke="#315f55" strokeWidth="0.7" />
    </FilePaper>
  );
}

export function VideoFileIcon(props: IconProps) {
  return (
    <FilePaper label="Video file" {...props}>
      <rect x="7" y="10" width="10" height="8" fill="#3f647c" stroke="#214d6b" strokeWidth="1" />
      <path d="M8 10v8M10 10v8M14 10v8M16 10v8" stroke="#c5d6df" strokeWidth="0.8" />
      <path d="M11 12l3 2-3 2z" fill="#f8f8f8" stroke="#ffffff" strokeWidth="0.5" />
    </FilePaper>
  );
}

export function MusicFileIcon(props: IconProps) {
  return (
    <FilePaper label="Music file" {...props}>
      <path d="M13 11v6.5a2 2 0 1 1-1-1.7V12l5-1v5.5a2 2 0 1 1-1-1.7V10z" fill="#7f4bb1" stroke="#4b2e70" strokeWidth="0.8" />
    </FilePaper>
  );
}

export function DesktopFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Desktop folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M6 11h12v7H6z" fill="#77b9e8" stroke="#214d6b" strokeWidth="1" />
      <path d="M9 20h6" stroke="#214d6b" strokeWidth="1.4" />
    </svg>
  );
}

export function DocumentsFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Documents folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M8 10h8v8H8z" fill="#f8f8f8" stroke="#6c747a" />
      <path d="M10 13h4M10 15h5" stroke="#486072" />
    </svg>
  );
}

export function DownloadsFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Downloads folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M12 10v6M8 14l4 4 4-4" fill="none" stroke="#2d70a8" strokeWidth="1.8" />
    </svg>
  );
}

export function MusicFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Music folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M13 10v7a2 2 0 1 1-1-1.7V11l5-1v6a2 2 0 1 1-1-1.7V10z" fill="#7f4bb1" />
    </svg>
  );
}

export function PicturesFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Pictures folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <path d="M6 11h12v7H6z" fill="#f8f8f8" stroke="#53636e" />
      <path d="M7 17l4-4 3 3 2-2 2 3z" fill="#5cab66" />
    </svg>
  );
}

export function VideosFolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Videos folder" {...props}>
      <path d="M2 7h7l2 2h11v10H2z" fill="#e9c85b" stroke="#7a5a14" strokeWidth="1.2" />
      <rect x="6" y="11" width="12" height="7" fill="#3f647c" stroke="#214d6b" />
      <path d="M8 11v7M10 11v7M12 11v7M14 11v7M16 11v7" stroke="#c5d6df" strokeWidth="1" opacity="0.85" />
      <path d="M12 12.5l3 2-3 2z" fill="#f8f8f8" />
    </svg>
  );
}

type KonquerorNodeIconProps = IconProps & {
  iconId: KonquerorNodeIconId;
};

export function KonquerorNodeIcon({ iconId, ...props }: KonquerorNodeIconProps) {
  switch (iconId) {
    case "home":
      return <HomeIcon {...props} />;
    case "desktop":
      return <DesktopFolderIcon {...props} />;
    case "documents":
      return <DocumentsFolderIcon {...props} />;
    case "downloads":
      return <DownloadsFolderIcon {...props} />;
    case "music":
      return <MusicFolderIcon {...props} />;
    case "pictures":
      return <PicturesFolderIcon {...props} />;
    case "videos":
      return <VideosFolderIcon {...props} />;
    case "trash":
      return <TrashIcon {...props} />;
    case "cdrom":
      return <DiscIcon {...props} />;
    case "floppy":
      return <FloppyIcon {...props} />;
    case "text-file":
      return <TextFileIcon {...props} />;
    case "markdown-file":
      return <MarkdownFileIcon {...props} />;
    case "html-file":
      return <HtmlFileIcon {...props} />;
    case "image-file":
      return <ImageFileIcon {...props} />;
    case "video-file":
      return <VideoFileIcon {...props} />;
    case "music-file":
      return <MusicFileIcon {...props} />;
    case "folder":
    default:
      return <FolderIcon {...props} />;
  }
}
