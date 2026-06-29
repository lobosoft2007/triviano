/**
 * Client-side image compression using <canvas>.
 *
 * Resizes any selected image to a max width (keeping aspect ratio) and
 * re-encodes it as JPEG. Quality is reduced iteratively until the file fits
 * under the target size, so uploads stay small and the PWA loads fast.
 */

interface CompressOptions {
  /** Maximum output width in pixels (height scales proportionally). */
  maxWidth?: number;
  /** Initial JPEG quality (0–1). */
  quality?: number;
  /** Target maximum file size in bytes. */
  maxSizeBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 800,
  quality: 0.75,
  maxSizeBytes: 150 * 1024, // 150 KB
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem selecionada."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality),
  );
}

/**
 * Compress an image file to a max width and target size.
 * Returns a new JPEG File; falls back to the original on any failure or if
 * the original is already smaller than the result.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof document === "undefined") return file;

  const { maxWidth, quality, maxSizeBytes } = { ...DEFAULTS, ...options };

  try {
    const img = await loadImage(file);

    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // White backdrop so transparent PNGs don't turn black as JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Step down quality until the blob fits under the target size.
    let q = quality;
    let blob = await canvasToBlob(canvas, q);
    while (blob && blob.size > maxSizeBytes && q > 0.4) {
      q -= 0.1;
      blob = await canvasToBlob(canvas, q);
    }
    if (!blob) return file;

    // Keep whichever is smaller (tiny originals may beat the re-encode).
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
