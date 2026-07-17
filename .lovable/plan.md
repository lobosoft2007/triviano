# Plano Fiscal — Motor Abstrato de Emissão e Recepção

## Objetivo
Tornar o sistema capaz de emitir NFC-e/NF-e, receber/manifestar NF-es de fornecedores e integrar entrada de estoque, usando um provedor SaaS fiscal agora, mas com arquitetura que permita trocar para ACBr ou solução nativa depois da Reforma Tributária sem refatorar o Caixa/Admin.

## Por que não nativo no Worker
A SEFAZ exige integração com 27 UFs + DF, cada uma com endpoints, schemas e regras próprios. A assinatura XML com certificado A1 depende de bibliotecas criptográficas que não rodam de forma confiável no runtime Cloudflare Worker atual. Além disso, é preciso implementar: contingências (FS-DA, SVC-RS/SP, EPEC), motor tributário (ICMS, CST/CSOSN, PIS/COFINS, IPI, FCP, DIFAL, ICMS-ST), geração de DANFE/DANFCe, manifestação do destinatário e manutenção contínua de schemas. Estimativa realista: 6+ meses de trabalho dedicado.

## Arquitetura proposta: motor fiscal interno + adapters
```text
Caixa/Admin/Perfil
        │
        ▼
┌───────────────────────┐
│  Motor Fiscal Interno │  ← domínio próprio: emitirNFCe, emitirNFe,
│  (server functions)   │    consultarDFe, manifestarNFe, obterDanfe
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│      Adapter Ativo    │  ← configurado por empresa
│  (SaaS / ACBr / Nativo)│
└───────────────────────┘
        │
        ▼
      SEFAZ
```
- O app chama apenas funções do **motor fiscal interno**.
- O motor chama o **adapter ativo** da empresa (SaaS hoje, ACBr/nativo amanhã).
- Cada adapter traduz os dados internos para o formato do provedor e vice-versa.
- Telas e regras de negócio não conhecem o provedor.

## Opções de adapter

### 1. Provedor SaaS fiscal (Tecnospeed, Focus NFe, PlugNotas, WebmaniaBR)
- Rápido de implementar, suportado pelo Worker (apenas HTTPS fetch).
- Custo por nota ou mensalidade fixa.
- Menor manutenção interna.
- Ideal para entrar no ar rápido.

### 2. ACBr próprio + servidor dedicado
- Open source, sem custo por nota.
- Requer servidor Windows/Linux com API HTTP própria.
- Maior controle, mas maior infraestrutura.

### 3. Nativo no Worker
- Invável hoje por limitações de runtime.
- Poderia ser reavaliado no futuro se o runtime suportar crypto PKCS#12.

## Por que essa abstração facilita a Reforma Tributária
- A reforma vai mudar cálculos, campos do XML e possivelmente criar novos documentos.
- Com adapters, as mudanças ficam isoladas na camada de tradução.
- Se o provedor SaaS atualizar a API, trocamos só o adapter.
- Se você decidir ir para ACBr ou nativo, trocamos só o adapter.
- O Caixa, o Admin e o estoque permanecem inalterados.

## Dados que devem ficar no nosso banco (independência do provedor)
- XML de envio e de autorização.
- Chave de acesso, número, série, status.
- PDF/DANFE/DANFCe (ou link + cópia).
- Eventos: cancelamento, carta de correção, manifestação.
- Configuração tributária por produto e por empresa.

## Escopo de documentos
- **NFC-e**: emissão automática no finalize_order_paid, DANFCe A4/térmica, QR code, contingência.
- **NF-e**: emissão manual/condicional para CNPJ, devoluções e notas de entrada, DANFE A4.
- **Manifestação do Destinatário**: polling de NSU, painel de Ciência/Confirmação/Desconhecimento/OPNR, download do XML.
- **Entrada automática no estoque**: ao confirmar NF de fornecedor, itens entram no estoque com mapeamento produto do fornecedor → insumo/subproduto cadastrado.

## Modelo tributário
- **Simples Nacional**: CSOSN, PIS/COFINS geralmente não destacados.
- **Lucro Presumido/Real**: CST completo, ICMS, PIS, COFINS, IPI, ICMS-ST quando aplicável.
- **Multi-tenant**: cada empresa/franquia define regime e regras tributárias nas configurações.

## Entregas sugeridas
1. Criar a camada de motor fiscal interno e a interface de adapter.
2. Implementar adapter para o provedor SaaS escolhido.
3. Configuração fiscal por empresa (regime, credenciais do provedor, certificado A1 se necessário).
4. Emissão de NFC-e no fluxo do Caixa.
5. Consulta e manifestação de NF-es de entrada.
6. Entrada automática no estoque a partir da NF confirmada.
7. Emissão de NF-e avulsa (B2B/devolução).
8. Documentação para troca futura de adapter.

## Pergunta para prosseguir
Você confirma o provedor **Tecnospeed** como o adapter inicial, com escopo **NFC-e + manifestação de NF-e de entrada + entrada automática no estoque**, mantendo a arquitetura de adapters para troca futura após a Reforma Tributária?