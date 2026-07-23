## Diagnóstico

Confirmado: hoje **não existe** UI para cadastrar/editar impressoras em lugar nenhum. O que existe:

- **`/caixa` → Configurações/Impressão**: mostra a lista de impressoras já cadastradas (só leitura — nome, cor, badge "Padrão" e um texto explicativo) e permite apenas **rotear categorias → impressora**. Não há botão "Adicionar impressora", nem campos de IP/porta/USB/tipo de conexão/cor/padrão/ativo/excluir.
- **`/admin`**: não tem aba de impressoras.
- **Backend**: já está 100% pronto — `src/lib/printers.ts` expõe `createPrinter`, `updatePrinter`, `deletePrinter` e a tabela `config_impressoras` tem todos os campos (`nome`, `tipo_conexao` USB/IP, `endereco_ip`, `porta`, `caminho_usb`, `cor`, `is_default`, `ativo`).

Ou seja, faltou só o formulário. Vou ligar a UI ao que já existe.

## O que vou fazer

Ampliar o bloco **"Setores de impressão"** da aba Configurações do `/caixa` para virar um CRUD completo (é onde o operador já procura hoje — mantém um lugar só, evita duplicar em `/admin`).

### 1. Botão "Adicionar impressora"
No topo da seção, abre um Dialog com formulário:
- **Nome** (ex.: "Cozinha", "Bar", "Pizzaria", "Balcão")
- **Tipo de conexão**: radio `USB` / `IP`
- **Se IP**: campos **Endereço IP** + **Porta** (default 9100)
- **Se USB**: campo **Caminho USB** (opcional, informativo)
- **Cor** (color picker — usada nas tags do Caixa)
- **Marcar como padrão** (switch — desmarca as outras via update)
- **Ativa** (switch, default ligado)

Valida nome obrigatório e IP/porta quando tipo = IP.

### 2. Cada `PrinterCard` ganha ações
- Mostra os dados reais (tipo de conexão, IP:porta ou caminho USB, status ativa/inativa).
- Botão **Editar** (mesmo Dialog, pré-preenchido).
- Botão **Excluir** (com confirmação; bloqueia se houver categoria apontando pra ela, oferecendo desvincular antes).
- Toggle **Ativa/Inativa** inline.

### 3. Persistência
Usa direto `createPrinter` / `updatePrinter` / `deletePrinter` de `src/lib/printers.ts` (já implementados) e invalida `["printers"]` + `["categories-routing"]` no React Query pra atualizar tudo em tempo real.

### 4. Textos e ajuda
Atualiza o parágrafo de ajuda pra deixar claro que:
- **USB / fila do SO** (fluxo atual, já homologado na release 1.7.4): configure a impressora como padrão no PC do caixa/cozinha e o Triviano dispara pela fila.
- **IP** hoje serve como identificação/metadado (roteamento + tag colorida). Impressão TCP:9100 direta do servidor **não** está implementada — se quiser habilitar, isso vira uma segunda etapa (posso propor plano separado).

### 5. `/admin`
Não vou adicionar aba nova — mantém tudo em um único lugar (`/caixa` → Configurações → Impressão) pra não fragmentar. Se preferir também em `/admin`, digo em uma linha depois de aprovar.

## Fora do escopo (não vou mexer)

- Motor de impressão (WebUSB/Serial/fila SO) — continua igual.
- Roteamento categoria→impressora — já funciona, não muda.
- Impressão direta via TCP/IP a partir do servidor — proponho em plano separado se quiser.
- RLS/GRANT e qualquer coisa financeira.