## Objetivo

Gerar um novo artefato `triviano-tap-fase-t-ops.zip` contendo o **projeto React Native completo e compilável no Android Studio**, consolidando todas as fases T0 → T-Ops, com a estrutura Android nativa completa (não apenas snippets).

## O que estava faltando no zip anterior

O `triviano-tap-fase-t-publish.zip` entregou os arquivos de configuração como *snippets* de referência (`build.gradle.signing.snippet`, trechos de ProGuard, etc.) para você colar sobre um projeto RN existente. Faltou o esqueleto Android completo — por isso não abre no Android Studio.

## Estrutura que o novo zip vai conter

```text
triviano-tap/
├── android/
│   ├── gradlew, gradlew.bat
│   ├── gradle/wrapper/{gradle-wrapper.jar, gradle-wrapper.properties}
│   ├── build.gradle, settings.gradle, gradle.properties
│   ├── local.properties.example
│   └── app/
│       ├── build.gradle              (com signingConfigs + splits ABI)
│       ├── proguard-rules.pro        (regras dos SDKs adquirentes)
│       ├── debug.keystore
│       └── src/main/
│           ├── AndroidManifest.xml   (permissões NFC, INTERNET, FOREGROUND_SERVICE)
│           ├── java/com/trivianotap/
│           │   ├── MainActivity.kt
│           │   ├── MainApplication.kt
│           │   └── bridges/         (MP Point, PagBank PlugPag, Cielo, Stone, Getnet, ESC/POS)
│           └── res/{mipmap-*, values, drawable}
├── ios/                              (projeto Xcode mínimo — opcional)
├── src/
│   ├── App.tsx, index.js
│   ├── screens/  (Comanda, Pagamento, Reembolso, Conciliação, Pareamento, Login PIN, Frota)
│   ├── lib/     (tapApi.ts, posApi.ts, heartbeat.ts, offlineQueue.ts, printer.ts)
│   └── bridges/ (wrappers TS das bridges nativas + modo simulador)
├── package.json, tsconfig.json, babel.config.js, metro.config.js
├── react-native.config.js
├── release.sh                        (bump versionCode + build AAB assinado)
├── CHECKLIST-ADQUIRENTES.md
├── PRIVACIDADE.md
└── README.md                         (passo-a-passo Android Studio)
```

## Passos de execução

1. Reconstruir o esqueleto RN 0.74 com `npx react-native init` como base e sobrepor todos os arquivos gerados nas fases T0..T-Ops.
2. Incluir `gradlew`/`gradlew.bat` + wrapper `.jar` (o que faltou) e `local.properties.example` para o SDK do Android.
3. Consolidar os *snippets* de assinatura, ProGuard e splits ABI diretamente dentro de `app/build.gradle` — sem arquivos `.snippet` soltos.
4. Adicionar bridges nativas completas (Kotlin) para MP Point, PagBank, Cielo, Stone, Getnet e impressão ESC/POS, cada uma com fallback simulador.
5. Incluir as telas da fase T-Ops (heartbeat, versão, fila offline) já ligadas ao backend existente (`/api/public/pos/*`).
6. Adicionar `README.md` com instruções: abrir a pasta `android/` no Android Studio, rodar `./gradlew :app:assembleRelease` ou usar `release.sh`.
7. Validar a árvore com `unzip -l` antes de publicar em `/mnt/documents/triviano-tap-fase-t-ops.zip` e emitir `<presentation-artifact>` para download.

## Backend

Nenhuma mudança de backend. Todas as tabelas, RPCs e rotas `/api/public/*` das fases T0..T-Ops já existem no projeto web e são consumidas pelo app pelo IP/host que você configurar em `src/lib/tapApi.ts`.

## Fora do escopo

- Publicar nas lojas / adquirentes (isso é operacional, com o CHECKLIST já entregue).
- Alterar qualquer código do PWA / Admin / Caixa web.
- Gerar keystore de produção (o `release.sh` cria sob demanda; o zip inclui apenas `debug.keystore`).
