## Selar Release Estável 1.7.4

Marcar o estado atual como novo ponto de retorno seguro, consolidando as melhorias recentes (impressão térmica direta, troco em dinheiro no "Finalizar e Receber", hardening anti-pirataria).

### Passo 1 — Bump de versão
Editar `src/lib/version.ts`:
- `APP_VERSION`: `1.7.3` → `1.7.4`
- `LAST_PATCH_DATE`: `2026-07-16`
- `VERSION_STATUS`: `ESTÁVEL`
- Adicionar ao `STABLE_RELEASE.validated` (no topo):
  - "Impressão térmica direta (WebUSB/Web Serial) da conta da mesa, sem preview do navegador — com fallback para window.print()"
  - "Pareamento e teste de impressora ESC/POS no Caixa → Configurações → Impressoras"
  - "Troco em dinheiro no Finalizar e Receber (calcula e exibe troco, corta excesso antes de gravar, preserva motor financeiro)"
  - "Hardening anti-pirataria: source maps desativados em produção (vite.config.ts) e .env bloqueado no .gitignore"
  - "Auditoria de rotas admin/caixa/superadmin confirmada sob _authenticated/ com guards rígidos"

### Passo 2 — Registrar memória de release
Criar `mem://releases/1.7.4-estavel` descrevendo o snapshot (impressão direta + troco + hardening) como ponto de retorno seguro, e atualizar `mem://index.md` referenciando-a (mantendo a 1.7.0 anterior na lista).

### Fora de escopo
- Nenhuma mudança de código funcional, banco, RLS ou motor financeiro.
- Sem publish automático — o usuário pode publicar quando quiser.
