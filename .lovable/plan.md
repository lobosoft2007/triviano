## Objetivo

Regerar `triviano-tap-fase-t-ops.zip` com o esqueleto React Native 0.74 **íntegro e compilável no Android Studio**, corrigindo o defeito que impede o Gradle de resolver o `@react-native/gradle-plugin` dentro de `node_modules`.

Não vou compilar o APK aqui — o sandbox não tem Android SDK/NDK/JDK Android e não tem como baixar os ~8GB necessários dentro dos limites de execução. O entregável é o zip pronto para você rodar `npm install` + `./gradlew assembleRelease` na sua máquina e obter o `app-release.apk` ainda hoje.

## Causa do erro atual

"Gradle não lê o script dentro de node_modules" no RN 0.74 sempre vem de um destes três problemas — o zip anterior tinha os três:

1. `node_modules/` não existia quando você abriu o Android Studio (o Gradle sync roda antes do `npm install`).
2. `android/settings.gradle` sem o bloco `pluginManagement { includeBuild("../node_modules/@react-native/gradle-plugin") }` que o RN 0.74 exige.
3. `gradle/wrapper/gradle-wrapper.jar` ausente ou com 0 bytes (era placeholder, não binário real).

## O que o novo zip vai conter

```text
triviano-tap/
├── android/
│   ├── gradlew, gradlew.bat                        (executáveis)
│   ├── gradle/wrapper/
│   │   ├── gradle-wrapper.jar                      (binário real ~60KB)
│   │   └── gradle-wrapper.properties               (Gradle 8.6)
│   ├── settings.gradle                             (com includeBuild do gradle-plugin)
│   ├── build.gradle                                (AGP 8.5, Kotlin 1.9.24, buildToolsVersion 34)
│   ├── gradle.properties                           (newArchEnabled=false, hermesEnabled=true)
│   ├── local.properties.example
│   └── app/
│       ├── build.gradle                            (applyNativeModulesAppBuildGradle + signingConfigs + splits ABI)
│       ├── proguard-rules.pro
│       ├── debug.keystore                          (binário real)
│       └── src/main/
│           ├── AndroidManifest.xml                 (NFC, INTERNET, FOREGROUND_SERVICE)
│           ├── java/com/trivianotap/
│           │   ├── MainActivity.kt
│           │   ├── MainApplication.kt              (registra os PackageLists gerados)
│           │   └── bridges/                        (MP Point, PagBank, Cielo, Stone, Getnet, ESC/POS — modo simulador ligado)
│           └── res/{mipmap-*, values, drawable}
├── src/                                            (App.tsx, screens T0..T-Ops, lib/, bridges/ TS)
├── package.json                                    (RN 0.74.5, deps travadas)
├── tsconfig.json, babel.config.js, metro.config.js, react-native.config.js
├── release.sh
├── CHECKLIST-ADQUIRENTES.md, PRIVACIDADE.md
└── README.md                                       (passo-a-passo abaixo)
```

## Processo de geração (o que faço no sandbox)

1. Rodar `npx --yes @react-native-community/cli init trivianotap --version 0.74.5 --skip-install` num diretório temporário para obter o esqueleto oficial (com wrapper .jar real, gradlew executável, settings.gradle e build.gradle corretos para RN 0.74).
2. Sobrepor os arquivos das fases T0..T-Ops (telas, `lib/`, `bridges/`, screens de Comanda/Pagamento/PIX/Reembolso/Conciliação/Frota).
3. Injetar em `app/build.gradle` o bloco `signingConfigs.release`, o `splits.abi` e o `applicationId com.trivianotap`.
4. Substituir `MainActivity.kt` / `MainApplication.kt` pelos que registram as bridges nativas (modo simulador ligado por default — funcional sem SDKs proprietários).
5. Copiar `release.sh`, `README.md`, `CHECKLIST-ADQUIRENTES.md`, `PRIVACIDADE.md`.
6. Validar com `unzip -l` que `gradle-wrapper.jar` tem >50KB, que `gradlew` existe e é executável, e que `settings.gradle` contém a string `@react-native/gradle-plugin`.
7. Publicar em `/mnt/documents/triviano-tap-fase-t-ops-v2.zip` e emitir `<presentation-artifact>`.

## README (passo-a-passo que você seguirá)

```bash
unzip triviano-tap-fase-t-ops-v2.zip
cd triviano-tap
npm install                                # baixa node_modules — INCLUINDO @react-native/gradle-plugin
cp android/local.properties.example android/local.properties
# edite sdk.dir para o caminho do seu Android SDK
cd android
./gradlew :app:assembleRelease             # gera app/build/outputs/apk/release/app-release.apk
```

Só depois de `npm install` abra a pasta `android/` no Android Studio. Se abrir antes, o Gradle sync falha exatamente com o erro que você viu.

## Modo simulador (importante para os testes de hoje)

As 5 bridges de cartão (MP Point, PagBank, Cielo, Stone, Getnet) sobem em **modo simulador** por default — retornam um pagamento aprovado fake sem precisar dos SDKs proprietários. Isso permite compilar e testar o fluxo completo (abrir mesa → lançar item → pagar → baixar no caixa) sem homologação. PIX (Mercado Pago/PagBank) já é real e chama o backend `/api/public/tap/pix/*` que está no ar.

## Fora do escopo

- Compilar o APK aqui — sem SDK Android no sandbox.
- Gerar keystore de produção — `release.sh` faz sob demanda; o zip só traz `debug.keystore`.
- Publicar nas lojas / homologar SDKs de cartão.
- Alterar backend / PWA / Admin / Caixa web.
