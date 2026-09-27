import { createRef, useEffect, useMemo } from "react";
import type { RefObject } from "react";
import { ProjectAboutIcon } from "../branding/ProjectAboutIcon";
import { PROJECT_ABOUT_ICON_ID } from "../branding/projectIdentity";
import { FullTrashIcon, KWriteIcon, MyComputerIcon, TrashIcon } from "../icons/IconComponents";
import { getVfsNodeById } from "../vfs/queries";
import { useVfs } from "../vfs/useVfs";
import { useOptionalKonquerorDragDrop } from "../apps/konqueror/KonquerorDragDropContext";
import { DesktopIcon } from "./DesktopIcon";
import { desktopIconDefinitions } from "./desktopIconModel";
import { getAdjacentDesktopIconId, getDesktopIconIds } from "./desktopIconState";
import { useI18n } from "../i18n/useI18n";

type DesktopIconsProps = {
  selectedIconId: string | null;
  selectedIconIds?: readonly string[];
  onSelectIcon: (iconId: string) => void;
  onClearSelection: () => void;
  onOpenIcon: (iconId: string) => void;
  onOpenContextMenu: (iconId: string, clientX: number, clientY: number) => void;
};

const renderDesktopIcon = (iconId: string, trashState: "empty" | "full") => {
  if (iconId === "trash") {
    return trashState === "full" ? (
      <FullTrashIcon aria-hidden="true" focusable="false" />
    ) : (
      <TrashIcon aria-hidden="true" focusable="false" />
    );
  }

  if (iconId === "kwrite") {
    return <KWriteIcon aria-hidden="true" focusable="false" />;
  }

  if (iconId === PROJECT_ABOUT_ICON_ID) {
    return <ProjectAboutIcon aria-hidden="true" focusable="false" />;
  }

  return <MyComputerIcon aria-hidden="true" focusable="false" />;
};

export function DesktopIcons({ onClearSelection, onOpenContextMenu, onOpenIcon, onSelectIcon, selectedIconId, selectedIconIds }: DesktopIconsProps) {
  const { t } = useI18n();
  const vfs = useVfs();
  const dragDrop = useOptionalKonquerorDragDrop();
  const registerDesktopTrashTarget = dragDrop?.registerDesktopTrashTarget;
  const trashNode = getVfsNodeById(vfs.state, vfs.state.specialLocations.trash);
  const trashState =
    trashNode.ok && trashNode.value.kind === "directory" && trashNode.value.childIds.length > 0 ? "full" : "empty";
  const iconRefs: Record<string, RefObject<HTMLButtonElement | null>> = useMemo(
    () =>
      Object.fromEntries(
        desktopIconDefinitions.map((definition) => [definition.id, createRef<HTMLButtonElement>()]),
      ),
    [],
  );

  const handleNavigate = (iconId: string, direction: "next" | "previous") => {
    const nextIconId = getAdjacentDesktopIconId(getDesktopIconIds(), iconId, direction);

    if (!nextIconId) {
      return;
    }

    onSelectIcon(nextIconId);
    iconRefs[nextIconId]?.current?.focus();
  };

  useEffect(() => {
    const trashRef = iconRefs["desktop-trash"];
    if (!registerDesktopTrashTarget || !trashRef) return;
    return registerDesktopTrashTarget({ targetId: "desktop-trash", elementRef: trashRef });
  }, [iconRefs, registerDesktopTrashTarget]);

  return (
    <section className="desktop-icons" role="group" aria-label={t("desktop.icons")}>
      {desktopIconDefinitions.map((definition) => (
        <DesktopIcon
          key={definition.id}
          ref={iconRefs[definition.id]}
          definition={definition}
          icon={renderDesktopIcon(definition.iconId, trashState)}
          trashState={definition.iconId === "trash" ? trashState : null}
          selected={selectedIconIds?.includes(definition.id) ?? selectedIconId === definition.id}
          isDropTarget={definition.id === "desktop-trash" && dragDrop?.activeDrag?.target?.kind === "trash"}
          onSelect={onSelectIcon}
          onOpen={onOpenIcon}
          onOpenContextMenu={onOpenContextMenu}
          onNavigate={handleNavigate}
          onClearSelection={onClearSelection}
        />
      ))}
    </section>
  );
}
