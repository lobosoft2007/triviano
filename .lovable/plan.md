## Diagnóstico

**Do I know what the issue is?** Sim.

A mensagem não está mais genérica: a captura mostra que o toast passou a exibir o erro real do backend:

```text
function gen_random_bytes(integer) does not exist
```

O problema atual está na função SQL `create_printer_agent_token`. Ela é `SECURITY DEFINER` e usa:

```sql
SET search_path TO public
```

Dentro dela, o SQL chama:

```sql
gen_random_bytes(32)
digest(v_token, 'sha256')
```

Essas funções vêm da extensão criptográfica do banco e, neste projeto, precisam ser chamadas com schema explícito. Como o `search_path` da função foi travado em `public`, o backend não encontra `gen_random_bytes` e a criação do agente falha.

## Por que antes parecia toast genérico

Antes, o frontend caía no fallback `Não foi possível criar o agente`. Depois do ajuste do toast, ele passou a mostrar a mensagem real. A prova é a própria captura: agora vemos o erro SQL completo, não só o texto genérico.

## Plano de correção

1. **Corrigir a RPC principal**
   - Recriar `create_printer_agent_token(nome text)`.
   - Trocar:
     - `gen_random_bytes(32)` por `extensions.gen_random_bytes(32)`
     - `digest(v_token, 'sha256')` por `extensions.digest(v_token, 'sha256')`
   - Manter `SECURITY DEFINER` e `SET search_path TO public`.

2. **Manter a compatibilidade JSONB**
   - Preservar `create_printer_agent_token(payload jsonb)` aceitando `nome` e `p_nome`.
   - Ela continuará chamando a função principal.

3. **Preservar permissões e escopo**
   - Reaplicar `GRANT EXECUTE` se necessário.
   - Não alterar pedidos, delivery, pagamentos, RLS global ou motor financeiro.

4. **Validar**
   - Confirmar que a RPC não retorna mais `42883`.
   - Confirmar que a criação do agente funciona ou, se houver outra falha, o toast mostra a mensagem real.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>