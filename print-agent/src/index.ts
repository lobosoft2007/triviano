import { config } from "./config";
import { log } from "./logger";
import { ack, claim, heartbeat, type AgentPrinter, type PrintJob } from "./api";
import { renderJob } from "./escpos";
import { sendToPrinter } from "./tcp";

let printers: AgentPrinter[] = [];
let running = true;

async function doHeartbeat() {
  try {
    const res = await heartbeat();
    printers = res.printers;
    log.info(`heartbeat ok (${printers.length} impressora(s))`);
  } catch (err) {
    log.warn(`heartbeat falhou: ${(err as Error).message}`);
  }
}

async function dispatchJob(job: PrintJob) {
  const printer = printers.find((p) => p.id === job.printer_id);
  if (!printer) {
    await ack(job.id, false, `impressora não configurada (${job.printer_id})`);
    return;
  }
  if (printer.tipo_conexao !== "IP" || !printer.endereco_ip) {
    await ack(job.id, false, `impressora ${printer.nome} não é IP`);
    return;
  }
  const port = printer.porta ?? 9100;
  try {
    const buf = renderJob(job, printer.encoding ?? undefined);
    await sendToPrinter(printer.endereco_ip, port, buf);
    await ack(job.id, true);
    log.info(`job ${job.id} impresso em ${printer.nome}`);
  } catch (err) {
    const msg = (err as Error).message;
    log.warn(`job ${job.id} falhou: ${msg}`);
    await ack(job.id, false, msg).catch(() => {});
  }
}

async function pollOnce() {
  try {
    const { jobs } = await claim(10);
    if (!jobs.length) return;
    log.info(`claim recebeu ${jobs.length} job(s)`);
    for (const j of jobs) {
      await dispatchJob(j);
    }
  } catch (err) {
    log.warn(`claim falhou: ${(err as Error).message}`);
  }
}

async function main() {
  log.info(`Triviano Print Agent iniciando…`);
  log.info(`API: ${config.apiBaseUrl}`);
  log.info(`Poll: ${config.pollIntervalMs}ms | HB: ${config.heartbeatIntervalMs}ms | Enc: ${config.printerEncoding}`);

  await doHeartbeat();
  const hbTimer = setInterval(doHeartbeat, config.heartbeatIntervalMs);

  const shutdown = (sig: string) => {
    log.info(`recebido ${sig}, encerrando…`);
    running = false;
    clearInterval(hbTimer);
    setTimeout(() => process.exit(0), 500);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (running) {
    await pollOnce();
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
  }
}

main().catch((err) => {
  log.error(`fatal: ${(err as Error).message}`);
  process.exit(1);
});
