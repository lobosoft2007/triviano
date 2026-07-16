/**
 * Direct thermal printer (ESC/POS) via WebUSB / Web Serial.
 *
 * Lets the Caixa page send raw ESC/POS bytes to a USB or serial receipt
 * printer without going through the browser's print dialog. The user grants
 * permission once via `navigator.usb.requestDevice` / `navigator.serial
 * .requestPort`; the browser remembers the device per profile, so subsequent
 * prints reuse the connection silently.
 *
 * Chromium-based browsers (desktop + Android). Safari/iOS have no WebUSB or
 * Web Serial — call sites must fall back to `window.print()`.
 */

export type ThermalTransport = "webusb" | "webserial";

export interface ThermalPreference {
  transport: ThermalTransport;
  vendorId?: number;
  productId?: number;
  serialNumber?: string | null;
  label: string; // Human-readable name to show in the UI.
}

const STORAGE_PREFIX = "thermal-printer:";

/* ---------------------------------------------------------------- */
/* Feature detection                                                 */
/* ---------------------------------------------------------------- */

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as unknown as {
    usb?: unknown;
  }).usb;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as unknown as {
    serial?: unknown;
  }).serial;
}

export function isSupported(): boolean {
  return isWebUsbSupported() || isWebSerialSupported();
}

/* ---------------------------------------------------------------- */
/* Preference persistence                                            */
/* ---------------------------------------------------------------- */

export function getPreference(empresaId: string): ThermalPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + empresaId);
    return raw ? (JSON.parse(raw) as ThermalPreference) : null;
  } catch {
    return null;
  }
}

export function setPreference(
  empresaId: string,
  pref: ThermalPreference,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + empresaId, JSON.stringify(pref));
}

export function clearPreference(empresaId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_PREFIX + empresaId);
}

/* ---------------------------------------------------------------- */
/* Minimal WebUSB / Web Serial typings                               */
/* ---------------------------------------------------------------- */

interface UsbEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: string;
}
interface UsbAlternate {
  endpoints: UsbEndpoint[];
}
interface UsbInterface {
  interfaceNumber: number;
  alternate: UsbAlternate;
}
interface UsbConfiguration {
  interfaces: UsbInterface[];
}
interface UsbDevice {
  vendorId: number;
  productId: number;
  serialNumber?: string | null;
  productName?: string;
  manufacturerName?: string;
  opened: boolean;
  configuration: UsbConfiguration | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: ArrayBuffer): Promise<unknown>;
}
interface UsbApi {
  requestDevice(opts: { filters: unknown[] }): Promise<UsbDevice>;
  getDevices(): Promise<UsbDevice[]>;
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}
interface SerialPort {
  getInfo(): SerialPortInfo;
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: unknown;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialApi {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

function getUsb(): UsbApi | null {
  return (navigator as unknown as { usb?: UsbApi }).usb ?? null;
}
function getSerial(): SerialApi | null {
  return (navigator as unknown as { serial?: SerialApi }).serial ?? null;
}

/* ---------------------------------------------------------------- */
/* Request / pair                                                    */
/* ---------------------------------------------------------------- */

export async function requestUsbDevice(): Promise<ThermalPreference> {
  const usb = getUsb();
  if (!usb) throw new Error("WebUSB não é suportado neste navegador.");
  // ESC/POS printers usually expose USB class 7 (Printer). We keep the
  // filter list open so any device shows in the picker — some vendors
  // advertise the printer as a vendor-specific class.
  const device = await usb.requestDevice({ filters: [] });
  return {
    transport: "webusb",
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber ?? null,
    label:
      device.productName ||
      device.manufacturerName ||
      `USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
  };
}

export async function requestSerialPort(): Promise<ThermalPreference> {
  const serial = getSerial();
  if (!serial) throw new Error("Web Serial não é suportado neste navegador.");
  const port = await serial.requestPort();
  const info = port.getInfo();
  return {
    transport: "webserial",
    vendorId: info.usbVendorId,
    productId: info.usbProductId,
    serialNumber: null,
    label: `Serial ${info.usbVendorId?.toString(16) ?? "?"}:${
      info.usbProductId?.toString(16) ?? "?"
    }`,
  };
}

/* ---------------------------------------------------------------- */
/* Send bytes                                                        */
/* ---------------------------------------------------------------- */

async function findPairedUsb(pref: ThermalPreference): Promise<UsbDevice> {
  const usb = getUsb();
  if (!usb) throw new Error("WebUSB não é suportado neste navegador.");
  const devices = await usb.getDevices();
  const match = devices.find(
    (d) =>
      d.vendorId === pref.vendorId &&
      d.productId === pref.productId &&
      (!pref.serialNumber || d.serialNumber === pref.serialNumber),
  );
  if (!match) {
    throw new Error(
      "Impressora não encontrada. Reconecte o cabo USB ou refaça o pareamento.",
    );
  }
  return match;
}

async function findPairedSerial(pref: ThermalPreference): Promise<SerialPort> {
  const serial = getSerial();
  if (!serial) throw new Error("Web Serial não é suportado neste navegador.");
  const ports = await serial.getPorts();
  const match = ports.find((p) => {
    const info = p.getInfo();
    return (
      info.usbVendorId === pref.vendorId &&
      info.usbProductId === pref.productId
    );
  });
  if (!match) {
    throw new Error(
      "Porta serial não encontrada. Reconecte o cabo ou refaça o pareamento.",
    );
  }
  return match;
}

async function sendUsb(pref: ThermalPreference, bytes: Uint8Array): Promise<void> {
  const device = await findPairedUsb(pref);
  const wasOpen = device.opened;
  if (!wasOpen) await device.open();
  try {
    if (!device.configuration) await device.selectConfiguration(1);
    const iface = device.configuration!.interfaces.find((i) =>
      i.alternate.endpoints.some(
        (e) => e.direction === "out" && e.type === "bulk",
      ),
    );
    if (!iface) throw new Error("Interface de impressora não encontrada.");
    const endpoint = iface.alternate.endpoints.find(
      (e) => e.direction === "out" && e.type === "bulk",
    )!;
    await device.claimInterface(iface.interfaceNumber);
    try {
      // Some printers accept chunks up to 64KB; split defensively.
      const CHUNK = 4096;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        await device.transferOut(endpoint.endpointNumber, bytes.subarray(i, i + CHUNK));
      }
    } finally {
      await device.releaseInterface(iface.interfaceNumber).catch(() => {});
    }
  } finally {
    if (!wasOpen) await device.close().catch(() => {});
  }
}

async function sendSerial(
  pref: ThermalPreference,
  bytes: Uint8Array,
): Promise<void> {
  const port = await findPairedSerial(pref);
  await port.open({ baudRate: 9600 });
  try {
    const writer = port.writable!.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close().catch(() => {});
  }
}

export async function printBytes(
  pref: ThermalPreference,
  bytes: Uint8Array,
): Promise<void> {
  if (pref.transport === "webusb") return sendUsb(pref, bytes);
  return sendSerial(pref, bytes);
}

/* ---------------------------------------------------------------- */
/* ESC/POS encoding                                                  */
/* ---------------------------------------------------------------- */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Very small ESC/POS builder aimed at 80mm cash-register printers. */
export class EscPos {
  private chunks: number[] = [];

  init(): this {
    this.chunks.push(ESC, 0x40); // ESC @
    // Codepage CP850 (multilingual Latin 1) — covers ç ã á é ó etc.
    this.chunks.push(ESC, 0x74, 0x02);
    return this;
  }
  align(mode: "left" | "center" | "right"): this {
    const map = { left: 0, center: 1, right: 2 } as const;
    this.chunks.push(ESC, 0x61, map[mode]);
    return this;
  }
  bold(on: boolean): this {
    this.chunks.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }
  doubleSize(on: boolean): this {
    // GS ! n — width+height multiplier (bit0-3 height, bit4-7 width).
    this.chunks.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }
  text(s: string): this {
    for (const byte of encodeCp850(s)) this.chunks.push(byte);
    return this;
  }
  line(s = ""): this {
    return this.text(s).newline();
  }
  newline(n = 1): this {
    for (let i = 0; i < n; i++) this.chunks.push(LF);
    return this;
  }
  feed(n = 3): this {
    this.chunks.push(ESC, 0x64, n); // ESC d n
    return this;
  }
  cut(): this {
    // GS V m — partial cut
    this.chunks.push(GS, 0x56, 0x42, 0x00);
    return this;
  }
  bytes(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

/**
 * Encode a UTF-8 string into CP850 bytes. Anything outside CP850 becomes
 * '?' — good enough for Portuguese/Spanish product names and PIX text.
 */
function encodeCp850(input: string): Uint8Array {
  const out: number[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      out.push(code);
      continue;
    }
    const mapped = CP850_MAP[ch];
    out.push(mapped ?? 0x3f);
  }
  return new Uint8Array(out);
}

// Minimal Unicode → CP850 lookup covering pt-BR/es-ES glyphs we actually print.
const CP850_MAP: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85,
  "å": 0x86, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b,
  "î": 0x8c, "ì": 0x8d, "Ä": 0x8e, "Å": 0x8f, "É": 0x90, "æ": 0x91,
  "Æ": 0x92, "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97,
  "ÿ": 0x98, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "£": 0x9c, "Ø": 0x9d,
  "×": 0x9e, "ƒ": 0x9f, "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3,
  "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6, "º": 0xa7, "¿": 0xa8, "®": 0xa9,
  "¬": 0xaa, "½": 0xab, "¼": 0xac, "¡": 0xad, "«": 0xae, "»": 0xaf,
  "Á": 0xb5, "Â": 0xb6, "À": 0xb7, "©": 0xb8, "¢": 0xbf, "ã": 0xc6,
  "Ã": 0xc7, "ð": 0xd0, "Ð": 0xd1, "Ê": 0xd2, "Ë": 0xd3, "È": 0xd4,
  "ı": 0xd5, "Í": 0xd6, "Î": 0xd7, "Ï": 0xd8, "Ó": 0xe0, "ß": 0xe1,
  "Ô": 0xe2, "Ò": 0xe3, "õ": 0xe4, "Õ": 0xe5, "µ": 0xe6, "þ": 0xe7,
  "Þ": 0xe8, "Ú": 0xe9, "Û": 0xea, "Ù": 0xeb, "ý": 0xec, "Ý": 0xed,
  "±": 0xf1, "°": 0xf8, "€": 0xd5, // best-effort
};

/* ---------------------------------------------------------------- */
/* Test coupon                                                       */
/* ---------------------------------------------------------------- */

export function buildTestCoupon(label: string): Uint8Array {
  const p = new EscPos().init();
  p.align("center").bold(true).doubleSize(true).line("*** TESTE OK ***");
  p.doubleSize(false).bold(false).newline();
  p.line(label);
  p.line(new Date().toLocaleString("pt-BR"));
  p.feed(3).cut();
  return p.bytes();
}
