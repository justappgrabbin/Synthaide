# Synthia Self-Build Readiness

## Already present

- Full Cordova/Acode Android source project.
- `package.json` + lockfile.
- Rspack application build configuration.
- Cordova Android configuration and build scripts.
- Acode terminal/proot execution substrate.
- Integrated Tool Factory for runtime JS/ATO tool synthesis.
- Source/file editing and filesystem capabilities.
- Native Android plugin sources carried in the project.

## Still required for true on-device APK self-build

1. **Modern Android build toolchain available on-device**
   - JDK 21
   - Android SDK platform 36
   - Build Tools / aapt2
   - d8/r8
   - apksigner
   - Gradle/Cordova dependencies

2. **Self-Build Automaton**
   - acquire/restore source workspace
   - verify source manifest
   - resolve cached/retrieved dependencies
   - invoke the build
   - collect build logs
   - locate resulting APK/AAB

3. **Signing identity**
   - secure signing-key storage or a deliberate development-key path
   - version/package metadata handling

4. **Artifact validation**
   - run Synthia verification before packaging
   - verify APK signature/hash
   - preserve rollback build

5. **Install/update handoff**
   - pass the completed APK to Android's package installer
   - handle package/version compatibility

6. **Source retrieval/bootstrap**
   - retrieve only missing/current source/build materials instead of carrying every historical donor archive in the installed app.

## Important distinction

Synthia can already synthesize and mount executable JS/ATO tools at runtime.

She cannot yet compile her complete Android APK by herself from inside the app because the modern Android toolchain and self-build lifecycle above are not yet wired as a Synthia Automaton.
