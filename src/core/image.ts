// Browser helper shared by the AI client and image-to-3D: any image -> small JPEG data URL.

/** Downscale to ≤1024 px JPEG so uploads stay small (Vercel body limit, faster AI). */
export async function toJpegDataUrl(image: File | string, max = 1024): Promise<string> {
  const src = typeof image === "string" ? image : URL.createObjectURL(image);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; // transparent PNG sketches → white paper, not black
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    if (typeof image !== "string") URL.revokeObjectURL(src);
  }
}
