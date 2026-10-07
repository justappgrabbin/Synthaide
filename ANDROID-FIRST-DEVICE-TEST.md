# Android build and first-device acceptance

This package is Synthia OS source based on Acode. It does not contain a completed APK.
The app includes its Acode foundation; installing Acode separately is not required.
Do not remove the editor/native plugin foundation from this build.

## Build prerequisites

- Node.js 22 or newer
- JDK 21 including `javac`
- Android SDK platform 36 and Build Tools 36.0.0
- Android platform-tools and a Gradle installation available to Cordova
- `ANDROID_HOME` and `JAVA_HOME` configured for those installations

The default package id is `world.synthia.acode` (not `com.foxdebug.acode`).
The minimum Android SDK is 26. The Kotlin plugin override remains 2.3.0 and
needs validation during a full native build.

## Clean build

```sh
npm ci
npm run test:synthia-complete
npm test
npm run typecheck
npm run setup
npx cordova requirements android
npm run build -- paid dev apk
```

`npm run setup` installs dependencies and restores the native Cordova platform
and plugins. Run it through npm so the local Cordova CLI is on PATH.
Generated `plugins/` and `platforms/` are restored from `src/plugins/` and the
locked dependencies; do not copy old plugin caches into a clean build.

Debug APK output:
`platforms/android/app/build/outputs/apk/debug/app-debug.apk`

Use `npm run build -- paid prod bundle` for a release Android App Bundle.
A production build also needs your signing configuration. Keep signing keys and
`build.json` private and outside Git history.

## Device acceptance

On a test device with USB debugging enabled:

```sh
adb devices
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Check Residence, Files, Editor, Terminal, Preview, Plugins, Morph, Morph Chat,
and Settings. Send a greeting and a coding request. Learn a grammar with
`Learn a grammar from: alpha beta gamma; alpha beta delta`, then request
`Build Geo-DEG geometry`. Verify the chat session survives switching panels.
Test enabled and disabled host permissions before relying on file/network effects.

Morph Chat's default provider is local and template-based. It is not a connected
large language model. The organism module is a callable state runtime; its approval
and metabolism state are not a complete background action executor.

No physical-device acceptance or APK signing verification has been completed in
this review environment. JavaScript tests and bundle compilation cannot substitute
for those checks. Historical documents mentioning `test:synthia-kimi-donor`,
`test:synthia-everything`, or 1101 tests describe another checkpoint and do not apply
to this archive.

## GitHub Actions APK build

The **Build Synthia Android APK** workflow installs the Android toolchain,
verifies the source, restores Cordova/Acode native components, and builds a
debug APK. It runs on pushes to `main` and can be started from the Actions tab
with **Run workflow**. After a successful run, download the
**Synthia-OS-debug-APK** artifact and extract `Synthia-OS-debug.apk`.
The artifact also includes a SHA-256 checksum and Android package metadata.

This debug build does not require a paid development environment or a private
release signing key. It bundles the native Cordova runtime and the Acode editor;
users do not need to install either separately. Production signing and actual
device acceptance remain separate release tasks.
