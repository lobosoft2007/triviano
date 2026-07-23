import * as fs from "node:fs";
import { config } from "./config";

function write(line: string) {
  const ts = new Date().toISOString();
  const out = `[${ts}] ${line}`;
  // eslint-disable-next-line no-console
  console.log(out);
  if (config.logFile) {
    try {
      fs.appendFileSync(config.logFile, out + "\n");
    } catch {
      // ignore
    }
  }
}

export const log = {
  info: (msg: string, meta?: unknown) =>
    write(`INFO  ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
  warn: (msg: string, meta?: unknown) =>
    write(`WARN  ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
  error: (msg: string, meta?: unknown) =>
    write(`ERROR ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
};
