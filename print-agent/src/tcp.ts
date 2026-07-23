import * as net from "node:net";
import { config } from "./config";

export function sendToPrinter(
  host: string,
  port: number,
  data: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        sock.destroy();
      } catch {
        /* noop */
      }
      err ? reject(err) : resolve();
    };
    sock.setTimeout(config.tcpTimeoutMs);
    sock.once("timeout", () => finish(new Error(`timeout ${host}:${port}`)));
    sock.once("error", (err) => finish(err));
    sock.connect(port, host, () => {
      sock.write(data, (err) => {
        if (err) return finish(err);
        // Dá 200ms para a impressora consumir e então fecha
        setTimeout(() => finish(), 200);
      });
    });
  });
}
