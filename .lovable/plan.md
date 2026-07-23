## Plano: resolver o 404 persistente ao criar agente

### O problema real
A tela ainda chama `/rpc/create_printer_agent_token` e recebe 404. Pela documentação do PostgREST, esse 404 em RPC significa função não encontrada **para a assinatura/parâmetros recebidos pela API**, ou schema cache desatualizado.

O banco foi conferido agora e contém:

```text
create_printer_agent_token(nome text)
anon: sem execução
authenticated: com execução
```

Então a função existe, mas a API que atende o browser ainda não está conseguindo casar a chamada real com a assinatura. Como o usuário continua vendo o erro, vou corrigir de forma tolerante para aceitar tanto a assinatura nova quanto a antiga.

### Do I know what the issue is?
Sim: o backend tem a função, mas o PostgREST está retornando 404 porque a assinatura exposta/cacheada não está casando com o payload que chega do frontend. A correção segura é manter a assinatura atual e adicionar uma compatibilidade que aceite também o formato antigo, além de melhorar a mensagem do erro.

### Correções
1. **Adicionar compatibilidade na RPC**
   - Manter `create_printer_agent_token(nome text)`.
   - Criar uma sobrecarga segura `create_printer_agent_token(jsonb)` que aceite payloads com `nome` ou `p_nome`.
   - Essa sobrecarga reutilizará a mesma lógica de permissão: Admin Master ou gerente/admin local da própria empresa.
   - Liberar execução apenas para `authenticated` e `service_role`, nunca para `anon`.
   - Recarregar o schema da API após a migration.

2. **Fortalecer o frontend**
   - Manter a chamada principal com `{ nome }`.
   - Se a API ainda responder 404 por cache/assinatura, tentar uma segunda chamada compatível com `{ p_nome: nome }` ou com fallback JSONB, sem criar duplicidade.
   - Converter qualquer erro do backend em `Error` com mensagem legível.

3. **Corrigir o toast definitivamente**
   - Substituir o fallback genérico por extração de `message`, `details`, `hint` e `code`.
   - Se ainda falhar, o toast deve mostrar a mensagem real do backend/PostgREST, por exemplo “Could not find…” ou “Acesso restrito…”.

4. **Validar**
   - Conferir no banco que existem as assinaturas esperadas.
   - Conferir que `anon` não executa e `authenticated` executa.
   - Conferir que as policies `tokens_admin_master` e `tokens_empresa_manager` continuam aplicadas.
   - Não mexer em pedidos, delivery, pagamentos, RLS de outras tabelas ou motor financeiro.

### Arquivos/áreas afetadas
- Migration do backend para a RPC de agente de impressão.
- `src/lib/printers.ts` para fallback e normalização de erro.
- `src/routes/_authenticated/caixa.tsx` apenas no catch/toast do modal de agente.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>