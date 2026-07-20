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
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: "#ffffff",
      onclone: (doc: Document) => {
        const style = doc.createElement("style");
        style.textContent = `
          :root, body, [data-report-capture], .report-a4, .report-a4 * {
            --background:#ffffff!important;--foreground:#111111!important;
            --card:#ffffff!important;--card-foreground:#111111!important;
            --popover:#ffffff!important;--popover-foreground:#111111!important;
            --primary:#111111!important;--primary-foreground:#ffffff!important;
            --secondary:#f2f2f2!important;--secondary-foreground:#111111!important;
            --muted:#eeeeee!important;--muted-foreground:#555555!important;
            --accent:#eeeeee!important;--accent-foreground:#111111!important;
            --destructive:#c0392b!important;--destructive-foreground:#ffffff!important;
            --success:#2f9e44!important;--success-foreground:#ffffff!important;
            --warning:#d99e00!important;--warning-foreground:#111111!important;
            --border:#cccccc!important;--input:#cccccc!important;--ring:transparent!important;
            --color-background:#ffffff!important;--color-foreground:#111111!important;
            --color-border:#cccccc!important;--color-input:#cccccc!important;--color-ring:transparent!important;
            color:#111111!important;border-color:#cccccc!important;box-shadow:none!important;text-shadow:none!important;
          }
          [data-report-capture] { background:#ffffff!important; }
        `;
        doc.head.appendChild(style);
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation },
    pagebreak: { mode: ["css", "legacy"] },
  };
}

/**
 * Render the report inside a temporary, isolated wrapper so no CSS custom
 * properties from the app (`--border: oklch(...)`, `color-mix(...)`, etc.)
 * leak into html2canvas and crash the PDF generation.
 */
async function withIsolatedClone<T>(
  node: HTMLElement,
  fn: (clone: HTMLElement) => Promise<T>,
): Promise<T> {
  const restoreRootCss = document.documentElement.getAttribute("style");
  const restoreBodyCss = document.body.getAttribute("style");
  const safeVars =
    "--background:#ffffff;--foreground:#111111;--border:#cccccc;--color-border:#cccccc;--input:#cccccc;--ring:transparent;background:#ffffff;color:#111111;border-color:#cccccc;";
  document.documentElement.style.cssText += safeVars;
  document.body.style.cssText += safeVars;

  const guard = document.createElement("style");
  guard.setAttribute("data-report-capture-guard", "true");
  guard.textContent = `
    [data-report-capture], [data-report-capture] *, .report-a4, .report-a4 * {
      --background:#ffffff!important;--foreground:#111111!important;
      --border:#cccccc!important;--color-border:#cccccc!important;
      --input:#cccccc!important;--ring:transparent!important;
      color:#111111!important;border-color:#cccccc!important;
      box-shadow:none!important;text-shadow:none!important;background-image:none!important;
    }
  `;
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-report-capture", "true");
  wrapper.style.cssText =
    "position:fixed;left:0;top:0;z-index:2147483647;width:auto;color:#111;background:#fff;border-color:#ccc;box-shadow:none;text-shadow:none;pointer-events:none;";
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  wrapper.appendChild(clone);
  document.head.appendChild(guard);
  document.body.appendChild(wrapper);
  try {
    return await fn(clone);
  } finally {
    wrapper.remove();
    guard.remove();
    if (restoreRootCss === null) document.documentElement.removeAttribute("style");
    else document.documentElement.setAttribute("style", restoreRootCss);
    if (restoreBodyCss === null) document.body.removeAttribute("style");
    else document.body.setAttribute("style", restoreBodyCss);
  }
}

export async function renderNodeToPdfBlob(
  node: HTMLElement,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
): Promise<Blob> {
  return withIsolatedClone(node, (clone) =>
    makeInstance()
      .set(baseOptions(filename, orientation))
      .from(clone)
      .outputPdf("blob"),
  );
}

export async function downloadNodeAsPdf(
  node: HTMLElement,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
): Promise<void> {
  await withIsolatedClone(node, (clone) =>
    makeInstance()
      .set(baseOptions(filename, orientation))
      .from(clone)
      .save(filename),
  );
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
