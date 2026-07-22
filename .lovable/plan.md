## Contexto correto

O botão é o **"Abater com cashback"** no `/caixa → Conta Corrente` (componente `ContaCorrenteTab`), acionado pelo operador de caixa/admin para um **cliente terceiro**. Ele chama a mesma RPC `abater_fiado_com_cashback(p_user_id)` — só que agora `p_user_id ≠ auth.uid()` (o operador está atuando em nome do cliente).

O toast "Erro ao abater." é o fallback do `catch` — o erro real vem da RPC/Supabase e não está sendo exibido (`err` não é `Error`, é `PostgrestError`).

## Diagnóstico

Preciso confirmar em qual etapa a RPC falha. Hipóteses prováveis, em ordem:

1. **Regra de autorização da RPC.** Hoje ela exige `has_role(auth.uid(), 'admin')` para agir sobre outro usuário. Funcionários operando o caixa sob a **matriz de permissões dinâmicas** (nivel_id, sem role `admin` na `user_roles`) são bloqueados com `Acesso restrito.` — mesmo tendo permissão de caixa.
2. **Trigger `prevent_profile_privilege_escalation`** no UPDATE de `profiles`. Para caller com role `admin` real passa; para funcionário sem role `admin` (mesmo com `can_manage_empresa`) barra a alteração de `saldo_cashback`/`saldo_devedor_fiado`.
3. **Ruído irrelevante.** Os erros de `postgres_changes` no console (`cannot add postgres_changes callbacks for realtime:caixa-orders after subscribe()`) são do canal Realtime do caixa se re-inscrevendo — não têm relação com o abatimento; ficam de fora deste plano.

## Correção proposta

Alinhar as duas checagens ao mesmo modelo já usado por `protect_profile_sensitive_columns` / demais RPCs do caixa: **quem pode gerenciar a empresa do cliente** pode operar, não apenas quem tem a role `admin`.

### 1. Ajustar a RPC `abater_fiado_com_cashback`
Trocar a autorização:
```sql
IF p_user_id <> auth.uid()
   AND NOT public.can_manage_empresa(
     (SELECT empresa_id FROM public.profiles WHERE id = p_user_id)
   ) THEN
  RAISE EXCEPTION 'Acesso restrito.';
END IF;
```
Assim admin master, admin de empresa e funcionário com permissão de caixa passam; cliente comum continua só podendo abater o próprio saldo.

### 2. Ajustar o trigger `prevent_profile_privilege_escalation`
Adicionar bypass para chamadas vindas de RPC SECURITY DEFINER (mesmo padrão de `protect_profile_sensitive_columns`):
```sql
IF current_user <> 'authenticated' THEN
  RETURN NEW;
END IF;
```
Mantém os bloqueios contra edição direta via Data API pelo próprio cliente; libera apenas UPDATE feito por RPCs autorizadas.

### 3. Melhorar a mensagem no cliente
Em `ContaCorrenteTab.handleAbater`, extrair `err.message` também de `PostgrestError` (`typeof err === "object" && err && "message" in err`) para o toast mostrar a razão real caso volte a falhar.

## Verificação
- Operador admin master abate cashback de um cliente com dívida → sucesso, saldo devedor cai, extratos gravados.
- Operador funcionário (nivel_id, sem role `admin`) roda a mesma ação → sucesso.
- Cliente comum tentando abater outro usuário via API → `Acesso restrito.`
- Cliente tentando `UPDATE profiles SET saldo_cashback = …` direto via PostgREST → continua bloqueado.
