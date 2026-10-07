# Synthia OS review — 7 October 2026

## What this archive is

`living-organism.zip` contains an Acode-based Android application source project
named Synthia OS. Acode supplies the editor, files, terminal, preview, plugins,
and native Cordova/Android integration. The intended product is one Synthia APK
containing that foundation; a separate Acode installation is not required.
The original archive contains no APK or AAB.

The source adds Morph animation/artifact intake, Morph Chat, grammar learning,
geometry, addressed capability registration, tool synthesis, and experimental
mesh/neural/orchestration modules. These are executable implementations with
unit tests, but their presence does not make every advertised higher-level
feature complete.

## Repairs

- Build configuration now keeps `world.synthia.acode` instead of changing it
  back to Acode's application id. The free variant uses `world.synthia.acodefree`.
- Setup recognizes Synthia's default variant and skips the AdMob plugin.
- Browser/terminal Android resource imports now use the full actual package id.
  Hooks use Cordova's project root rather than assuming a plugin cache location.
- The system FileProvider hook patches only its own authority, leaving the
  Cordova core FileProvider and terminal document provider intact. First-time
  preparation handles the manifest not existing yet.
- A missing temporary flavor flag no longer silently lowers target SDK 36 to 28.
  An explicitly selected legacy F-Droid flavor retains its prior behavior.
- Build/start scripts stop on failure instead of continuing to native packaging
  after configuration or JavaScript compilation fails. Bundle output is correctly
  described as an Android App Bundle rather than an AAR library.
- Organism completion is listed as a callable capability, and its state is
  included in Synthia runtime diagnostics. This does not add a background executor.
- The comprehensive Synthia test command now runs all existing Node test files,
  including organism, address, Klein, lab, and end-to-end tests previously omitted.
- Corrected one stale execution-path assertion; added regression coverage for
  Android identity, resource imports, and distinct provider authorities.
- Added source Git ignore rules and current build/readiness instructions. Generated
  plugin/platform caches and nested installed dependencies are excluded from the
  corrected source package; `src/plugins/` is retained as the canonical source.

## Verification

- Original Node tests: 111 passed.
- Full app tests after fixes: 330 passed across 49 files.
- After the final provider refinement, all 18 affected app/config/hook tests passed.
- Comprehensive Synthia command: 111 passed, followed by a passing source audit.
- TypeScript check: passed.
- Production JavaScript bundle: compiled successfully; two size warnings remain.
- Clean Cordova Android 15.1.0 preparation: passed after regeneration from source.
- Generated native browser/terminal imports: `world.synthia.acode.R`.
- Generated provider authorities remain distinct: Cordova core, terminal documents,
  and `world.synthia.acode.provider` for the system plugin.
- Actual build configuration preserves Synthia's package id and target SDK source.
- `npm run build -- paid dev apk`: JavaScript compilation and native preparation
  passed, then APK compilation stopped because `ANDROID_HOME`/Android SDK is absent.
- No Capacitor dependencies or configuration were found in the supplied source.

Logs are included under `review-evidence/` in the corrected source ZIP.

## Readiness and remaining work

This is suitable as a reviewed source checkpoint for GitHub. It is not yet a
verified finished Android release. This environment lacks the complete Android
SDK/Gradle/JDK compiler setup, so APK compilation and physical-device testing
remain unverified. No signed APK has been produced during this review.

Morph Chat currently uses a local template provider. No general-purpose language
model is connected by default. The organism module implements bounded state,
action proposals, approvals, memory, and metabolism; it is mounted as a callable
capability, not a complete autonomous background effect executor. Its proposed
or active action state is not proof that an external task has executed.

Full on-device APK self-building, precision transit/ephemeris activation, native
Browser Hand execution, and complete application synthesis still have documented
prerequisites or missing integrations. Historical documents refer to absent donor
archives and test scripts; their old test counts are not current verification.

For release readiness: complete the native toolchain setup, build the APK, install
on a test device, run the acceptance checklist, and configure private signing for
a production release. Keep the working Acode foundation. This reviewed source checkpoint is published in `justappgrabbin/Synthaide`.
Publication of source does not constitute a signed APK release.
