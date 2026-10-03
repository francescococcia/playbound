/** Short name for floating 3D labels: first ~3 words, max ~22 chars. Full label stays in the inspector. */
export function shortLabel(label: string, max = 22): string {
  const words = label.trim().split(/\s+/);
  let out = "";
  for (let i = 0; i < Math.min(3, words.length); i++) {
    const next = out ? `${out} ${words[i]}` : words[i];
    if (next.length > max) break;
    out = next;
  }
  if (!out) out = label.slice(0, max);
  if (out.length < label.trim().length) {
    const clipped = out.length >= max ? out.slice(0, max - 1) : out;
    return `${clipped}…`;
  }
  return out;
}
