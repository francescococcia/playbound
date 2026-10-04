import { Copy, FilePlus, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useHistory } from "../../core/history";
import { usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Role } from "../../core/types";
import { viewGroundCenter } from "../viewPick";

const ADD_ROLES: Role[] = ["cover", "block", "landmark", "prop", "spawn", "objective"];
const ICON = { size: 16, strokeWidth: 1.75 } as const;

/** Add / Delete / Duplicate / New level — all no-ops while locked. */
export function EditTools() {
  const locked = usePlaybound((s) => s.level.locked);
  const selectedId = usePlaybound((s) => s.selectedId);
  const level = usePlaybound((s) => s.level);
  const addVolume = usePlaybound((s) => s.addVolume);
  const removeVolume = usePlaybound((s) => s.removeVolume);
  const duplicateVolume = usePlaybound((s) => s.duplicateVolume);
  const newLevel = usePlaybound((s) => s.newLevel);
  const canUndo = useHistory((s) => s.past.length > 0);
  const canRedo = useHistory((s) => s.future.length > 0);
  const undo = useHistory((s) => s.undo);
  const redo = useHistory((s) => s.redo);
  const [addOpen, setAddOpen] = useState(false);

  const selected = level.volumes.find((v) => v.id === selectedId) ?? null;
  const canDuplicate =
    !locked && selected != null && selected.role !== "spawn" && selected.role !== "objective";
  const canDelete = !locked && selected != null;

  const deleteWhy = locked ? "Unlock to edit" : !selected ? "Select a box to delete" : "Delete (Del)";
  const duplicateWhy = locked
    ? "Unlock to edit"
    : !selected
      ? "Select a box to duplicate"
      : selected.role === "spawn" || selected.role === "objective"
        ? "Can't duplicate spawn/objective"
        : "Duplicate (Ctrl+D)";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedId) return;
        e.preventDefault();
        removeVolume(selectedId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (!selectedId) return;
        e.preventDefault();
        duplicateVolume(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, selectedId, removeVolume, duplicateVolume]);

  const onAdd = (role: Role) => {
    if (locked) return;
    const pos = viewGroundCenter();
    const lim = level.bounds - 1;
    const x = Math.min(lim, Math.max(-lim, pos[0]));
    const z = Math.min(lim, Math.max(-lim, pos[2]));
    addVolume(role, [x, 0, z]);
    setAddOpen(false);
  };

  const onNew = () => {
    if (locked) return;
    if (!window.confirm("Start a blank level? Unsaved layout changes will be lost.")) return;
    newLevel();
  };

  return (
    <div className="edit-tools">
      <div className="edit-row">
        <div className="add-wrap">
          <button
            type="button"
            className="icon-inline"
            disabled={locked}
            title={locked ? "Unlock to edit" : "Add a box at the view centre"}
            onClick={() => setAddOpen((o) => !o)}
          >
            <Plus {...ICON} aria-hidden />
            Add
          </button>
          {addOpen && !locked && (
            <ul className="add-menu" role="menu">
              {ADD_ROLES.map((role) => (
                <li key={role}>
                  <button type="button" role="menuitem" onClick={() => onAdd(role)}>
                    <span className="vol-swatch" style={{ background: ROLE_COLORS[role] }} />
                    {role}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="icon-inline"
          disabled={!canDelete}
          title={deleteWhy}
          onClick={() => selectedId && removeVolume(selectedId)}
        >
          <Trash2 {...ICON} aria-hidden />
          Delete
        </button>
        <button
          type="button"
          className="icon-inline"
          disabled={!canDuplicate}
          title={duplicateWhy}
          onClick={() => selectedId && duplicateVolume(selectedId)}
        >
          <Copy {...ICON} aria-hidden />
          Duplicate
        </button>
      </div>
      <div className="edit-row edit-history-row">
        <button
          type="button"
          className="icon-inline"
          disabled={locked || !canUndo}
          title={locked ? "Unlock to undo" : "Undo (Ctrl+Z)"}
          onClick={undo}
        >
          <Undo2 {...ICON} aria-hidden />
          Undo
        </button>
        <button
          type="button"
          className="icon-inline"
          disabled={locked || !canRedo}
          title={locked ? "Unlock to redo" : "Redo (Ctrl+Y)"}
          onClick={redo}
        >
          <Redo2 {...ICON} aria-hidden />
          Redo
        </button>
      </div>
      <button
        type="button"
        className="new-level-btn icon-inline"
        disabled={locked}
        title={locked ? "Unlock to edit" : "Blank level"}
        onClick={onNew}
      >
        <FilePlus {...ICON} aria-hidden />
        New level
      </button>
    </div>
  );
}
