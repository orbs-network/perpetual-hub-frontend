import { snapdom } from "@zumer/snapdom";
import { partner } from "@/config/partners";

export async function renderElementToPng(element: HTMLElement) {
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    throw new Error("Share card is not visible");
  }

  const scale = Math.max(2, window.devicePixelRatio || 1);
  return snapdom.toBlob(element, {
    backgroundColor: partner.theme.surface,
    embedFonts: true,
    height: Math.round(height * scale),
    type: "png",
    width: Math.round(width * scale),
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
