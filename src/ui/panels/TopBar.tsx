// PLACEHOLDER — Cursor owns this. Replace freely.
import { usePlaybound } from "../../core/store";

export function TopBar() {
  const { level, runProve, lock } = usePlaybound();
  return (
    <header style={{ padding: 8, borderBottom: "1px solid #30363d", display: "flex", gap: 8, alignItems: "center" }}>
      <strong>PLAYBOUND</strong> <span style={{ opacity: 0.6 }}>Prove the greybox. Then dress it.</span>
      <span style={{ flex: 1 }} />
      <button onClick={runProve}>Prove</button>
      <button onClick={lock} disabled={level.prove?.status !== "pass"}>Lock</button>
      <span>{level.prove?.message ?? "not proven"}</span>
    </header>
  );
}
