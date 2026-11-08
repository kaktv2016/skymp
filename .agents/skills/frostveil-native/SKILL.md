---
name: frostveil-native
description: Investigate or validate SkyMP C++, ABI, native runtime identity, CrashDump, and Skyrim compatibility changes.
---

# Frostveil native

**Inputs**

Exact source commit, native binaries/build identity, Skyrim and masters identity, symptom or requested native contract.

1. Read `CLAUDE.md`, `CMakeLists.txt`, relevant `unit/` tests and the applicable existing Frostveil report. Audit installed versions/hashes and ABI before attributing symptoms.
2. Build with the configured CMake toolchain and run the relevant Catch/CTest checks from the build directory. Inspect `rp-gamemode/scripts/native-integration.cjs` and its fixture prerequisites before using `npm run test:native`.
3. For a crash preserve private dump, stack, module versions, symbols and trigger. Correlate the failing frame and actual build before proposing a patch.
4. Record build and test receipts, runtime compatibility and remaining owner checks separately.

**Outputs and blockers**

Source/ABI/artifact identities and scoped results. Missing symbols, an unresolved native crash or mismatched ABI blocks a runtime claim. Never experiment against the live world or force-close Skyrim.
