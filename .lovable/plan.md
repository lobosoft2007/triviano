## Fila de Impressão — reimpressão universal + número do pedido

Ajustar o painel `PrintQueuePanel` para (1) permitir reimprimir jobs em qualquer status (não só `failed`/`expired`) e (2) mostrar o número do pedido para identificar visualmente o cupom a ser reimpresso.

### Banco — `public.retry_print_job(p_job_id uuid)`

Migração única, substitui a função atual:

- Aceita jobs em `pending | printing | done | failed | expired`.
- Bloqueia apenas quando `status='printing' AND locked_until > now()` → `RAISE EXCEPTION 'Job em impressão. Aguarde alguns segundos e tente novamente.'`.
- Reset: `status='pending', attempts=0, last_error=NULL, claimed_at=NULL, locked_until=NULL, printed_at=NULL, next_attempt_at=now()`.
- Autorização: `EXISTS (SELECT 1 FROM public.print_jobs pj WHERE pj.id=p_job_id AND public.can_manage_empresa(pj.empresa_id))`, senão `RAISE EXCEPTION 'Sem permissão para reimprimir este job.'`.
- `SECURITY DEFINER`, `SET search_path = public`.
- `REVOKE ALL ... FROM public; GRANT EXECUTE ... TO authenticated, service_role;`.

### UI — `src/components/caixa/PrintQueuePanel.tsx`

- Ampliar `PrintJobRow` com `order_id: string | null` e `payload: Record<string, unknown> | null` e incluir os dois no `.select(...)`.
- Helper `orderLabel(job)`:
  1. `job.payload?.order?.senha_diaria` → `"#{valor}"`.
  2. senão `job.payload?.order?.senha` → `"S{valor}"`.
  3. senão `job.order_id?.slice(0,6).toUpperCase()` → `"{valor}"`.
  4. senão `"—"`.
- Nova badge "Pedido" logo depois do status, antes da impressora: `<Badge variant="outline" className="font-mono bg-muted text-foreground border-border">{orderLabel(j)}</Badge>`. Em mobile mantém visível (é a informação-chave).
- Botão "Reimprimir" passa a renderizar para **todos** os status, com `disabled` quando `j.status === 'printing'` (fallback de UX; o RPC também bloqueia se o lock ainda estiver ativo).
- Toast de sucesso: `"Pedido ${orderLabel} reenfileirado"`. Erro continua exibindo `err.message` (permissão / job em impressão).

### Fora do escopo

- Agente local, endpoints `/print-agent/*` e formatador ESC/POS (impressão está correta).
- `enqueue_print_jobs`, triggers e demais RPCs de impressão.

### Verificação

1. Reimprimir job `done` → sai novamente com o mesmo número identificado no toast.
2. Reimprimir job `failed` → atende como hoje, agora com identificação visual.
3. Tentar reimprimir job `printing` com lock ativo → botão desabilitado; se disparado via RPC direto retorna erro amigável.
4. Sem `order_id` (job de teste) → badge mostra `"—"` e reimpressão segue funcionando.
