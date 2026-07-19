
# Ícone e nome do App Tap por empresa (whitelabel Android)

## Objetivo
Cada empresa-cliente terá seu próprio APK do Triviano Tap com:
- **Ícone do launcher** próprio (fornecido pelo cliente)
- **Nome exibido** próprio (ex.: "Clube 23 – Garçom", "Pizzaria Teste – Garçom")

Sem precisar duplicar o código-fonte do app — um único projeto Android gera N APKs a partir de uma configuração central.

## Como isso vai funcionar (visão geral)

```text
Admin (web)                Backend                    Build do APK
-----------                -------                    ------------
Upload do ícone     →   pos_app_branding      →   Script pega branding
Nome do app "…"         (por empresa_id)          da empresa e gera APK
                                                   assinado por cliente
```

O admin da empresa faz upload do ícone e escolhe o nome no painel. O time do Triviano (ou pipeline automatizado) roda um comando que lê esses dados e produz o APK "brandizado" daquela empresa.

---

## Parte 1 — Cadastro no Admin (web)

Nova sub-aba em **Admin → Maquininhas (POS) → App branding**:

- Campo "Nome do app" (padrão: `{nome_fantasia} – Garçom`, editável, máx. 30 chars — limite do launcher Android)
- Upload do ícone (PNG quadrado, mín. 512x512, fundo opaco ou transparente)
  - Preview mostrando como fica em círculo, quadrado e squircle (formatos de launcher)
  - Validação de tamanho/formato no cliente antes de subir
- Botão "Baixar APK personalizado" — dispara o pipeline (Parte 3)

## Parte 2 — Backend

**Nova tabela `pos_app_branding`** (uma linha por empresa):
- `empresa_id` (FK, unique)
- `app_label` (text) — nome exibido no launcher
- `icon_path` (text) — caminho no Storage do ícone fonte 1024x1024
- `updated_at`

**Novo bucket privado `pos-app-icons`** — armazena o ícone fonte enviado pelo admin. Signed URL de leitura restrita ao admin daquela empresa e ao service_role (usado pelo pipeline de build).

**RLS**: apenas `admin` da própria empresa lê/escreve; `service_role` lê tudo (para o build).

**RPC `admin_get_pos_branding()`** — devolve o registro da empresa ativa para a UI do admin.

## Parte 3 — Pipeline de build por empresa

Script Node no repositório do app móvel (`triviano-tap`) — **não altera o app web**:

1. `bun run build:tap -- --empresa=<uuid>` (ou slug)
2. Script consulta `pos_app_branding` via service_role, baixa o ícone fonte
3. Gera os mipmaps Android (`mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi` + `mipmap-anydpi-v26/ic_launcher.xml` adaptativo) com `sharp`
4. Injeta `app_label` em `android/app/src/main/res/values/strings.xml` (`<string name="app_name">`)
5. Grava `empresa_id` em `assets/tenant.json` que o app já lê no boot (para pré-carregar branding e apontar API)
6. Roda `./gradlew assembleRelease` assinando com a keystore Triviano (uma keystore só, todos os APKs assinados por nós — evita fricção de cada cliente gerar a sua)
7. Copia `app-universal-release.apk` para `dist/triviano-tap-<slug-empresa>-<versao>.apk`

Pipeline pode rodar local (comando manual) e depois ser plugado em CI (GitHub Actions com matriz por empresa).

## Parte 4 — Documentação para o cliente

Página no admin explicando:
- Especificação do ícone (1024x1024, PNG, área de segurança de 66% para o formato adaptativo)
- Limite de 30 caracteres no nome
- Como instalar o APK personalizado na maquininha (link para o guia ADB já existente)

---

## Detalhes técnicos

- **Application ID**: mantém `com.triviano.tap` único (não usamos `applicationIdSuffix` por empresa — dois APKs de empresas diferentes na mesma maquininha é caso raro; se surgir, adicionamos flavor por empresa depois).
- **Ícone adaptativo (Android 8+)**: gerar `ic_launcher_foreground.png` (área central 66%) + `ic_launcher_background.xml` (cor sólida = `cor_primaria` da empresa, aproveitando o campo já existente em `empresas`).
- **Fallback legacy**: `ic_launcher.png` tradicional para Android 7 e anterior (Smart POS antigos).
- **Sem impacto no app web/PWA**: mudanças ficam confinadas ao repositório `triviano-tap` + uma tabela nova + uma aba no admin.
- **Segurança**: o ícone é uploaded para bucket privado; o pipeline usa service_role apenas no ambiente de build (nunca no browser).

## Fora do escopo desta fase
- Assinatura por keystore do cliente (fica para uma Fase 2 se algum cliente exigir)
- Publicação em Play Store por cliente (o APK é sideloaded na maquininha, como já é hoje)
- Personalização de splash screen (pode virar Fase 2 usando o mesmo `pos_app_branding`)
