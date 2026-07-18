
# Triviano Garçom POS — App Android para Smart POS

Aplicativo Android nativo dedicado ao garçom, rodando **dentro** das maquininhas Rede Smart, PagSeguro Moderninha Smart e InfinitePay Smart. Reaproveita toda a lógica multi-tenant, banco e RPCs já existentes do Triviano — o app é uma casca Android que consome as mesmas APIs do PWA e integra os SDKs de pagamento e impressão de cada fabricante.

## Estratégia técnica

**Não** é PWA embarcado. As lojas de apps das adquirentes exigem APK Android nativo assinado, com uso dos SDKs oficiais para cobrança e impressão. Optar por PWA/WebView reprova homologação e impede acesso aos periféricos.

Stack escolhida: **React Native (bare workflow)** com módulos nativos Java/Kotlin para cada SDK de adquirente. Motivo:
- Reaproveita ~80% dos componentes JS/TS existentes (telas, tipos, chamadas Supabase).
- Compartilha `src/lib/*` (mesa, cart, notifications, empresa, permissions) via monorepo.
- Um único APK com **flavors** por adquirente (`rede`, `pagseguro`, `infinitepay`) — cada flavor empacota só o SDK daquela loja, evitando conflitos e reduzindo tamanho.

Projeto vive em novo diretório irmão do PWA (`triviano-pos/`), compartilhando código via workspace.

## Escopo funcional (v1)

1. **Login pareado por device + PIN por garçom**
   - Primeiro uso: master admin gera "código de pareamento" no `/admin` que amarra o device a uma `empresa_id`. Salva token de longa duração seguro no Android Keystore.
   - Uso diário: garçom digita PIN de 4-6 dígitos (novo campo `profiles.pin_pos_hash`, apenas para funcionários com nivel_id). PIN valida via nova server function `pos_login_pin`.

2. **Abrir mesa e lançar pedidos**
   - Reaproveita `abrir_solicitacao_mesa`/`liberar_mesa` — garçom age no papel de operador (auto-visto) OU escaneia QR da mesa via câmera da maquininha.
   - Tela de cardápio compacta (grid touch de setor→produto), com customizações e adicionais já existentes.
   - Envia com `enviar_pedido_mesa` (mesma RPC do PWA).

3. **Ver comanda e fechar conta**
   - Reusa `fetchComandaById`, `fetchComandaPedidos`, `fechar_comanda`.

4. **Cobrança de cartão na maquininha**
   - Módulo nativo unificado `PaymentBridge` com interface JS única (`charge({ amount, method })`).
   - Implementações por flavor:
     - **Rede Smart**: SDK Userede/Rede Pay.
     - **PagSeguro**: PlugPag SDK.
     - **InfinitePay**: SDK Cloud (`br.com.infinitepay.pos`).
   - Fluxo: garçom escolhe "Cobrar mesa", seleciona split se quiser, escolhe crédito/débito → SDK abre tela nativa → app recebe comprovante → grava em `pagamentos_pedido` e chama `finalize_comanda_split` existente, com um novo meio de pagamento `CARTAO_POS_<flavor>`.

5. **Impressão de comanda/cupom na própria maquininha**
   - Módulo nativo `PrinterBridge` com `printText(commands)`; implementação por flavor usando a impressora térmica embutida (todas expõem API própria).
   - Reaproveita layouts `SectorReceipt`/`BillReceipt` — porta o texto para ESC/POS simples.

6. **Notificações**
   - Realtime Supabase (via lib JS já existente) para novos pedidos, chamadas de mesa e status.
   - Sem push nativo na v1 — o app fica em foreground durante o turno.

## Backend (mudanças mínimas)

Migração única:

- `profiles.pin_pos_hash TEXT` (hash bcrypt) — só operadores com `nivel_id`.
- `pos_devices` — pareamento device↔empresa: `id`, `empresa_id`, `nome`, `token_hash`, `flavor` (rede/pagseguro/infinitepay), `last_seen_at`, `revogado_em`. RLS via `can_manage_empresa`. GRANT authenticated/service_role.
- Novos meios de pagamento seed: `CARTAO_CREDITO_POS`, `CARTAO_DEBITO_POS` (por empresa, com `is_sistema=true` e `percentual_cashback` configurável).
- Server functions:
  - `pos_pair_device(codigo)` — chamada pelo app com código do admin, retorna token.
  - `pos_login_pin(pin)` — valida PIN do garçom no contexto do device, retorna claims curtas.
  - `pos_register_payment(pedido_id, meio_id, valor, nsu, autorizacao, bandeira)` — grava split e chama `finalize_comanda_paid`/`_split` conforme o caso.
- No `/admin` (aba Configurações da Empresa): nova seção **Maquininhas (POS)** — gera código de pareamento, lista devices, permite revogar.

## Estrutura do repositório

```text
triviano/                (PWA atual — inalterado)
triviano-pos/            (novo)
├── android/
│   ├── app/
│   │   ├── src/rede/         (flavor Rede + SDK)
│   │   ├── src/pagseguro/    (flavor PagSeguro + PlugPag)
│   │   └── src/infinitepay/  (flavor InfinitePay)
│   └── build.gradle          (productFlavors)
├── src/
│   ├── screens/ (Login, PinPad, Mesas, Cardapio, Comanda, Cobrar, Config)
│   ├── native/  (PaymentBridge.ts, PrinterBridge.ts — TS types)
│   └── lib/     (symlink/reexport de triviano/src/lib compartilhado)
└── package.json
```

## Homologação e distribuição

Cada adquirente exige processo próprio (formulário técnico, APK assinado, testes com maquininha física, revisão de segurança). Cronograma real:

1. **Rede Smart** — Portal Rede Developer, prazo típico 2-4 semanas.
2. **PagSeguro** — Portal PagBank Dev, 3-6 semanas.
3. **InfinitePay** — Marketplace CloudWalk, 2-3 semanas.

Cada uma tem seu próprio pipeline de build (`assembleRedeRelease`, etc.). Precisamos abrir contas developer nas três antes de gerar APKs de homologação.

## Fora do escopo desta v1

- Modo offline com fila (adiciona ~2 semanas — proposta v2).
- NFC-e emitida direto da maquininha (fica no PWA/Caixa por enquanto).
- Push nativo FCM.
- App para gerente com relatórios.

## Fases de entrega

**Fase 0 — Fundação backend (1 sprint)**
- Migração `pos_devices` + `pin_pos_hash` + meios de pagamento POS.
- Server functions `pos_pair_device`, `pos_login_pin`, `pos_register_payment`.
- Aba "Maquininhas (POS)" no `/admin` com CRUD de códigos e devices.

**Fase 1 — App base (1 sprint)**
- Scaffold RN bare + monorepo compartilhando `src/lib`.
- Fluxo de pareamento + PIN + navegação.
- Telas Mesas / Cardápio / Comanda (sem SDK ainda).

**Fase 2 — Bridges nativos (2 sprints, um flavor por vez)**
- Flavor **InfinitePay** primeiro (SDK mais simples, homologação mais rápida) — `PaymentBridge` + `PrinterBridge`.
- Depois **Rede Smart**.
- Depois **PagSeguro**.

**Fase 3 — Homologação (paralelo, gerido pelo usuário)**
- Submissão nos três portais.

## Ponto de decisão antes de codar

Preciso confirmar duas coisas antes de abrir a Fase 0:

1. **Onde mora o repositório do app**: crio `triviano-pos/` dentro deste mesmo projeto Lovable (Lovable não builda Android, então seria apenas o código-fonte versionado aqui) OU você abre repositório separado no GitHub e eu entrego só os patches de backend + instruções? Recomendo **repositório separado** — Lovable é focado em web; o CI Android roda melhor em GitHub Actions/Bitrise.

2. **Fase 0 imediata**: começo agora só pela **fundação backend** (migração + server functions + tela de pareamento no /admin), que já é útil e é 100% no escopo do Lovable, e o app RN entra num repo à parte?
