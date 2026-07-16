
## Resposta curta
Sim, funciona — mas só se, ao cadastrar o cliente no Admin, nós criarmos de fato um **usuário de autenticação** (em `auth.users`) já com e-mail confirmado e uma senha aleatória descartável. Sem isso, o "Esqueci minha senha" responde "e-mail não encontrado" e o cliente não consegue entrar.

Hoje a tela `Admin → Clientes` (`ClientesView.tsx`) só lê/edita `profiles`. Ela não cria conta de auth. Então precisamos adicionar esse fluxo.

## Como vai funcionar (fluxo do cliente)
1. Operador cadastra o cliente no Admin com nome, telefone, endereço e **e-mail** (obrigatório).
2. Sistema cria o usuário em `auth.users` (e-mail já confirmado, senha aleatória forte que ninguém verá) e o `profiles` correspondente com todos os dados.
3. Opcional: já disparar o e-mail de redefinição na hora ("Enviar link de definição de senha").
4. Cliente abre o link do restaurante → **Entrar** → **Esqueci minha senha** → digita o e-mail → recebe o e-mail (template `recovery.tsx` que já existe) → cai em `/auth/update-password` (rota que já existe) → define a senha → entra normalmente.

## O que vou construir

### Backend (server function protegida, admin-only)
- `src/lib/clientes-admin.functions.ts` com `createClienteByAdmin`:
  - `.middleware([requireSupabaseAuth])` + checagem de papel admin da empresa do operador.
  - `await import("@/integrations/supabase/client.server")` dentro do handler.
  - `supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, password: <random 32 chars>, user_metadata: { full_name, empresa_id } })`.
  - `UPSERT` em `public.profiles` com todos os campos do formulário (nome, CEP, endereço atomizado, telefone, `empresa_id`, etc.), vinculado ao `id` retornado.
  - Se `enviarLinkAgora === true`: `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })` **ou** deixar o cliente fazer o "Esqueci minha senha" sozinho (mais simples e usa o fluxo padrão já homologado).
  - Retorna `{ ok, userId }`. Se o e-mail já existir, retorna erro amigável ("Já existe cliente com esse e-mail").

### Frontend (Admin)
- Em `src/components/admin/ClientesView.tsx`: novo botão **"Novo cliente"** abrindo um `Dialog` com `AddressFields` + Nome + E-mail + checkbox "Enviar link de definição de senha agora".
- Chama a server fn acima, invalida `["clientes"]`, mostra toast do tipo _"Cliente criado. Ele receberá o link para definir a senha ao clicar em 'Esqueci minha senha' na tela de acesso."_ (ou "Link enviado para o e-mail X" quando marcado).

### Nada muda em:
- `/auth` (esqueci minha senha) — já funciona.
- `/auth/update-password` — já funciona.
- Templates de e-mail (`recovery.tsx`) — já customizados.
- Motor financeiro / RLS / triggers — **não tocar**.

## Pré-requisitos que já estão OK
- Envio de e-mails auth ativo (template `recovery` já em `src/lib/email-templates/recovery.tsx`).
- Rota `/auth/update-password` existente e testada.
- `profiles` já aceita todos os campos de endereço.

## Ponto de atenção
- Rate-limit de e-mails de auth do projeto: se o Admin cadastrar muitos clientes num curto período e todos pedirem redefinição no mesmo momento, pode bater no limite. Já temos ferramenta para aumentar quando necessário; sinalizo se acontecer.
- Clientes sem e-mail (só telefone) **não** conseguem usar esse fluxo — a redefinição de senha exige e-mail. Nesse caso o cadastro precisa ser feito pelo próprio cliente na tela de acesso, como hoje.

Posso implementar?
