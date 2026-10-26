# G2.4.1B reproducibility and evidence

No ESP/NIF/DDS/TGA/BSA or compiled executable is committed here. The actual owned five-file draft is local under `build/rp-audit/g241/dev-7FNiLN/staging-7RaVpv`; activation remains disabled. `evidence.json` is sanitized observational evidence, not a signed/approved modpack manifest.

From the repository root:

```powershell
npm test --prefix rp-gamemode
node --test rp-gamemode/research/g241b/tests/*.test.cjs
node .\rp-gamemode\scripts\g241b-inspect.cjs
node .\rp-gamemode\scripts\g241b-path-audit.cjs
node .\rp-gamemode\scripts\g241b-integrate.cjs '.\build\rp-audit\g241\dev-7FNiLN'
```

The six explicit real-asset tests require the owner's supplied revision in the documented Steam Data location; they are separated from portable RP unit tests because the assets are not redistributed. They capture the observed uncorrected material state. After authoring changes, re-inspect the actual new revision and update its acceptance evidence; never call a corrected asset a failing product merely because an old negative fixture assertion changed. There were no skipped real-asset tests in this run.

Inspect/path-audit are read-only. Integrate reuses the disabled development package when the five hashes match; it exits nonzero while the material/resource/signing gates are blocked. It writes only project staging/report/code-snapshot files. It does not approve templates, install game files, edit plugin lists, sign, publish, upload or start a gameplay server. TGA intermediates are omitted.

## Read-only BSA query helper

The existing pinned `rsm-bsa 4.1.0` static library is in `build/vcpkg_installed/x64-windows-sp`; the query utility performs named-member availability checks only. Build outputs must remain in the ignored audit folder. Reproduce with the installed VS toolchain (adjust only the verified local VS path if it changes):

```powershell
$vs='C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat'
$src=(Resolve-Path 'rp-gamemode\research\g241b\tools\bsa-index-query.cpp').Path
New-Item -ItemType Directory -Force 'build\rp-audit\g241b\tools' | Out-Null
$out=(Resolve-Path 'build\rp-audit\g241b\tools').Path
$exe=Join-Path $out 'bsa-index-query.exe'
$lib=(Resolve-Path 'build\vcpkg_installed\x64-windows-sp\lib').Path
$inc=(Resolve-Path 'build\vcpkg_installed\x64-windows-sp\include').Path
cmd /d /s /c "call `"$vs`" -arch=amd64 -host_arch=amd64 >nul && cl /nologo /std:c++20 /EHsc /MT /I`"$inc`" /Fo`"$out\bsa-index-query.obj`" `"$src`" /link /LIBPATH:`"$lib`" bsa.lib binary_io.lib mmio.lib fmt.lib lz4.lib zlib.lib /OUT:`"$exe`""
```

No engine/native DLL build or modification is involved. Archive hashes observed locally are consistency data, not a pinned Bethesda provenance baseline. BSA membership and narrow NIF structure checks cannot prove complete scene/skin/shader closure. The root report lists exact remaining gates and conditional owner commands.
