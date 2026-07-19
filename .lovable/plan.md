## Objetivo

Corrigir o erro `Could not find method autolinkLibrariesWithApp()` alinhando o React Native e o pacote `@react-native/gradle-plugin` na versão 0.75.4, em que essa API existe. O `app/build.gradle` já está no padrão 0.75, então só o JS/TS side precisa subir de versão.

## Escopo

Regenerar o zip `triviano-tap-fase-t-ops-v3.zip` com o `package.json` ajustado. Nenhum código do app (bridges, telas, backend) muda.

## Alterações

**`package.json`** — bump para RN 0.75.4 e pares oficiais:

```json
"dependencies": {
  "react": "18.3.1",
  "react-native": "0.75.4"
},
"devDependencies": {
  "@react-native/babel-preset": "0.75.4",
  "@react-native/eslint-config": "0.75.4",
  "@react-native/metro-config": "0.75.4",
  "@react-native/typescript-config": "0.75.4",
  "@react-native/gradle-plugin": "0.75.4"
}
```

Demais dependências (`@react-navigation/*`, `async-storage`, `camera-kit`, `safe-area-context`) permanecem — todas compatíveis com RN 0.75.

**`android/gradle.properties`** — garantir `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` (RN 0.75 exige as 4 ABIs listadas explicitamente para o autolink funcionar).

**Nenhum outro arquivo muda.** Bridges Kotlin, `MainApplication.kt`, `AndroidManifest.xml`, telas e lógica JS ficam idênticos.

## Passos do usuário após receber o v3

Na pasta raiz do zip novo:

```powershell
# 1. Limpar instalação anterior (o node_modules do v2 é incompatível)
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\.gradle, android\app\build, android\build -ErrorAction SilentlyContinue

# 2. Reinstalar
npm install

# 3. Build
cd android
.\gradlew :app:assembleRelease
```

APK final em `android\app\build\outputs\apk\release\app-release.apk`.

## Riscos

- Nenhum código de aplicação muda, só versões — risco baixo.
- Primeira build depois do bump baixa dependências novas (~3-5 min extras).
- Se aparecer erro de peer dependency no `npm install`, resolver com `npm install --legacy-peer-deps` (fluxo padrão em RN).

## Entregável

`triviano-tap-fase-t-ops-v3.zip` disponível para download no painel de arquivos, com instruções acima no `README.md`.