/**
 * PDF + WhatsApp share helpers built on top of html2pdf.js.
 *
 * The functions expect an *already rendered* DOM node (usually kept hidden with
 * `position: fixed; left: -10000px`). Callers keep full control over the layout
 * so we can reuse the A4 report skeleton (`.report-a4`).
 */
import html2pdf from "html2pdf.js";

interface Html2PdfInstance {
  set: (opts: unknown) => Html2PdfInstance;
  from: (el: HTMLElement) => Html2PdfInstance;
  outputPdf: (type: "blob") => Promise<Blob>;
  save: (filename?: string) => Promise<void>;
}

function makeInstance(): Html2PdfInstance {
  return (html2pdf as unknown as () => Html2PdfInstance)();
}

function baseOptions(filename: string, orientation: "portrait" | "landscape") {
  return {
    filename,
    margin: [12, 10, 16, 10],
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: "mm", format: "a4", orientation },
    pagebreak: { mode: ["css", "legacy"] },
  };
}

export async function renderNodeToPdfBlob(
  node: HTMLElement,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
): Promise<Blob> {
  return makeInstance()
    .set(baseOptions(filename, orientation))
    .from(node)
    .outputPdf("blob");
}

export async function downloadNodeAsPdf(
  node: HTMLElement,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
): Promise<void> {
  await makeInstance()
    .set(baseOptions(filename, orientation))
    .from(node)
    .save(filename);
}

/**
 * Try to share the generated PDF via the OS/native share sheet (works on
 * Android/PWA/iOS Safari 16+). Falls back to downloading the file and opening
 * WhatsApp Web with an instructional text when the Web Share API cannot
 * attach files.
 *
 * Returns `"shared"` when the native share sheet handled it, otherwise
 * `"fallback"` (file downloaded + WhatsApp opened).
 */
export async function shareNodeAsPdfWhatsapp(
  node: HTMLElement,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
  message = "Segue a Ordem de Compra em anexo.",
  phone?: string | null,
): Promise<"shared" | "fallback"> {
  const blob = await renderNodeToPdfBlob(node, filename, orientation);
  const file = new File([blob], filename, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
  };

  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ title: filename, text: message, files: [file] });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "shared";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  const text = encodeURIComponent(
    `${message}\n(Arquivo baixado: ${filename}. Anexe-o nesta conversa.)`,
  );
  const digits = (phone ?? "").replace(/\D/g, "");
  const target = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(target, "_blank", "noopener,noreferrer");
  return "fallback";
}
