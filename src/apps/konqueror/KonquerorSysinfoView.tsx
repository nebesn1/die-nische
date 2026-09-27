import { useMemo, type ReactNode } from "react";
import { MyComputerIcon } from "../../icons/IconComponents";
import type { VfsState } from "../../vfs/types";
import { formatVfsByteSize } from "./formatters";
import { getBrowserSystemInfo } from "./sysinfo/systemInfoModel";
import { summarizeVfsUsage } from "./sysinfo/vfsUsage";
import { useI18n } from "../../i18n/useI18n";

type KonquerorSysinfoViewProps = {
  readonly vfsState: VfsState;
  readonly onOpenDirectory: (nodeId: string) => void;
};

export function KonquerorSysinfoView({ onOpenDirectory, vfsState }: KonquerorSysinfoViewProps) {
  const { t } = useI18n();
  const systemInfo = getBrowserSystemInfo();
  const usage = useMemo(() => summarizeVfsUsage(vfsState), [vfsState]);
  const commonFolders = [
    { label: t("konqueror.page.personalFiles"), nodeId: vfsState.specialLocations.documents },
    { label: t("konqueror.page.homeFolder"), nodeId: vfsState.specialLocations.home },
    { label: t("konqueror.page.rootFolder"), nodeId: vfsState.rootId },
  ];

  return (
    <section className="konqueror-sysinfo" aria-label={t("konqueror.page.systemInformation")}>
      <header className="konqueror-sysinfo__header">
        <MyComputerIcon aria-hidden="true" focusable="false" />
        <div><h1>{t("konqueror.page.myComputer")}</h1><p>{t("konqueror.page.virtualStorage")}</p></div>
      </header>
      <div className="konqueror-sysinfo__columns">
        <div className="konqueror-sysinfo__column">
          <section className="konqueror-sysinfo__section"><h2>{t("konqueror.page.commonFolders")}</h2>
            {commonFolders.map((folder) => <button key={folder.label} type="button" onClick={() => onOpenDirectory(folder.nodeId)}>{folder.label}</button>)}
            <button type="button" disabled title={t("konqueror.page.unavailablePrototype")}>{t("konqueror.page.networkFolders")}</button>
          </section>
          <InfoSection title={t("konqueror.page.networkStatus")}><InfoRow label={t("konqueror.page.status")} value={systemInfo.online ? t("konqueror.page.online") : t("konqueror.page.offline")} /></InfoSection>
          <InfoSection title={t("konqueror.page.cpu")}><InfoRow label={t("konqueror.page.logicalProcessors")} value={systemInfo.logicalProcessors?.toString() ?? t("konqueror.page.unavailable")} /></InfoSection>
          <InfoSection title={t("konqueror.page.memory")}><InfoRow label={t("konqueror.page.deviceMemory")} value={systemInfo.deviceMemoryGb === null ? t("konqueror.page.unavailable") : `${systemInfo.deviceMemoryGb} GB`} /></InfoSection>
        </div>
        <div className="konqueror-sysinfo__column">
          <InfoSection title={t("konqueror.page.disk")}><InfoRow label={t("konqueror.page.device")} value="KDE3 Virtual Disk" /><InfoRow label={t("konqueror.page.filesystem")} value="In-memory VFS" /><InfoRow label={t("konqueror.page.usedSpace")} value={`${formatVfsByteSize(usage.usedBytes)} (${usage.fileCount} files)`} /><InfoRow label={t("konqueror.page.totalSpace")} value="—" /><InfoRow label={t("konqueror.page.availableSpace")} value="—" /></InfoSection>
          <InfoSection title={t("konqueror.page.os")}><InfoRow label={t("konqueror.page.os")} value={systemInfo.platform ?? t("konqueror.page.unavailable")} /><InfoRow label={t("konqueror.page.currentUser")} value="user@kde3 (web session)" /><InfoRow label={t("konqueror.page.system")} value={t("desktop.shell")} /><InfoRow label="KDE" value="KDE 3-inspired browser desktop" /></InfoSection>
          <InfoSection title={t("konqueror.page.display")}><InfoRow label={t("konqueror.page.resolution")} value={systemInfo.screenWidth === null || systemInfo.screenHeight === null ? t("konqueror.page.unavailable") : `${systemInfo.screenWidth} × ${systemInfo.screenHeight}`} /><InfoRow label={t("konqueror.page.colorDepth")} value={systemInfo.colorDepth === null ? t("konqueror.page.unavailable") : `${systemInfo.colorDepth} bit`} /><InfoRow label={t("konqueror.page.deviceScale")} value={systemInfo.devicePixelRatio?.toFixed(1) ?? t("konqueror.page.unavailable")} /></InfoSection>
        </div>
      </div>
    </section>
  );
}

function InfoSection({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  return <section className="konqueror-sysinfo__section"><h2>{title}</h2><dl>{children}</dl></section>;
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return <><dt>{label}</dt><dd>{value}</dd></>;
}
