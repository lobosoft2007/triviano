## Plano: Reverter finding para ignorado

### Contexto
O finding `regras_combos_public_select` foi marcado como fixed na interação anterior, mas deve permanecer ignorado conforme decisão atual do usuário. Os outros dois findings (`SUPA_anon_security_definer_function_executable` e `SUPA_authenticated_security_definer_function_executable`) já estão corretamente ignorados.

### Ações

1. **Alterar status do finding no security scanner**
   - Chamar `manage_security_finding` para `regras_combos_public_select` com operação `ignore`.
   - Justificativa: o acesso público às regras de combos é intencional e controlado via `get_public_menu` (SECURITY DEFINER com colunas seguras); a política pública direta em `regras_combos` foi removida e substituída por controle via função definer, portanto o scanner detecta um resíduo arquitetural que não representa vulnerabilidade ativa.

2. **Atualizar security memory**
   - Revisar o documento de segurança para refletir que `regras_combos_public_select` é um finding ignorado (não fixed).
   - Manter a descrição do modelo de acesso controlado (SECURITY DEFINER, RLS por empresa, permissões dinâmicas).

### Resultado esperado
- O finding `regras_combos_public_select` aparece na lista de ignorados do scanner.
- A security memory permanece consistente com a postura de segurança atual do projeto.
- Nenhuma alteração de código é necessária.