## Objetivo

Criar, no repositório mobile `triviano-tap` (Android/React Native), um pipeline de build **whitelabel automatizado** que gera um APK por empresa-cliente puxando ícone + nome direto de `pos_app_branding` no backend. Primeiro cliente configurado: **Clube 23**.

## Arquitetura

```text
[Backend Lovable]                    [Repo triviano-tap (VSCode)]
pos_app_branding      ── fetch ─►    scripts/fetch-branding.ts
pos-app-icons bucket                        │
                                            ▼
                                     tenants/<slug>/
                                       ├── tenant.json
                                       └── icon-source.png
                                            │
                                     scripts/apply-branding.ts
                                            │
                          ┌─────────────────┼───────────────────┐
                          ▼                 ▼                   ▼
                 strings.xml         mipmap-*/ic_launcher   applicationId
                  (app_name)          (redimensionado)       + versionCode
                                            │
                                     gradlew assembleRelease
                                            │
                                     dist/<slug>-vX.Y.Z.apk
```

## Entregáveis (no repo `triviano-tap`)

### 1. Endpoint de leitura no backend (este repo)
- Nova rota `GET /api/public/pos/branding/:slug` (ou por `empresa_id` autenticado com service token de build).
  - Autenticada via header `x-build-token` (secret novo `POS_BUILD_TOKEN`).
  - Retorna `{ app_label, icon_signed_url, package_suffix, version }`.
  - Motivo: o script de build não tem sessão de usuário; precisa de canal server-to-server.

### 2. Scripts (Node/TS) no repo mobile
- `scripts/fetch-branding.ts <slug>` — baixa metadados + `icon-source.png` para `tenants/<slug>/`.
- `scripts/apply-branding.ts <slug>` — usa `sharp` para gerar:
  - `mipmap-mdpi/ic_launcher.png` (48), `hdpi` (72), `xhdpi` (96), `xxhdpi` (144), `xxxhdpi` (192)
  - `mipmap-anydpi-v26/ic_launcher.xml` (adaptive) + foreground/background
  - `ic_launcher_round.png` em todos os buckets
  - Atualiza `android/app/src/main/res/values/strings.xml` (`app_name`)
  - Atualiza `applicationId` em `android/app/build.gradle` (ex.: `com.triviano.tap.clube23`)
  - Escreve `android/app/src/main/assets/tenant.json` (empresa_id, api base) — lido pelo app em runtime para saber contra qual tenant autenticar.
- `scripts/build-tenant.sh <slug>` — orquestra: `fetch` → `apply` → `./gradlew clean assembleRelease` → move APK para `dist/<slug>-<version>.apk`.
- `scripts/build-all.ts` — lê `tenants.json` (lista de slugs) e roda `build-tenant.sh` em série para gerar APKs de todos os clientes.

### 3. Configuração inicial Clube 23
- Adicionar `tenants/clube23/` (gerado automaticamente na primeira execução).
- `tenants.json` inicial: `["clube23"]`.
- Preencher `pos_app_branding` do Clube 23 no Admin (nome "Clube 23 - Garçom" + ícone).

### 4. package.json (repo mobile)
```json
"scripts": {
  "build:tap": "bash scripts/build-tenant.sh",
  "build:tap:all": "tsx scripts/build-all.ts",
  "brand:fetch": "tsx scripts/fetch-branding.ts",
  "brand:apply": "tsx scripts/apply-branding.ts"
}
```
Uso em VSCode: `bun run build:tap clube23` → APK pronto em `dist/`.

### 5. Documentação
- `README-BUILD.md` no repo mobile explicando:
  - Pré-requisitos (JDK 17, Android SDK, keystore, `.env` com `LOVABLE_API_URL` + `POS_BUILD_TOKEN`).
  - Como cadastrar novo cliente (Admin → Maquininhas → Branding → rodar `bun run build:tap <slug>`).
  - Como assinar (keystore único do Triviano, `applicationId` por tenant evita conflito de instalação).

## O que fica neste repo web (o que faço agora quando aprovar)

1. Nova rota `src/routes/api/public/pos/branding.$slug.ts` com auth por `POS_BUILD_TOKEN` (secret).
2. Adicionar coluna `slug` em `pos_app_branding` (ou usar `empresas.slug` existente — verifico na implementação) para o build encontrar o tenant sem expor `empresa_id`.
3. Registrar o secret `POS_BUILD_TOKEN`.

## O que fica para o repo mobile (fora deste projeto)

Todos os scripts `scripts/*`, mudanças em `android/`, `package.json` mobile e `README-BUILD.md`. Vou entregar os arquivos como um ZIP/patch para você colar no `triviano-tap`, igual fizemos no `triviano-tap-fase-t-ops-v3.zip`.

## Pergunta antes de implementar

Confirma **duas coisas**:

1. **Identificador do tenant no build**: prefere usar `empresas.slug` (já existente) ou criar um campo dedicado em `pos_app_branding`? Recomendo `empresas.slug`.
2. **applicationId**: OK usar padrão `com.triviano.tap.<slug>` (cada cliente vira app separado no launcher, sem conflito ao instalar dois na mesma maquininha)?
