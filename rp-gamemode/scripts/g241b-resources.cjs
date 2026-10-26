'use strict';
// Read-only G2.4.1B dependency audit. This deliberately does not extract BSA
// members or treat unverified index manifests as proof of archive contents.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_NIF = 32 * 1024 * 1024;
const MAX_GRAPH_RECORDS = 512;
const MAX_GRAPH_DEPTH = 24;
const NIF_HEADER = Buffer.from('Gamebryo File Format, Version 20.2.0.7\n', 'ascii');
const PATH_RE = /(?:^|[^A-Za-z0-9_.-])((?:meshes|textures|actors|interface|sound|scripts|seq|strings|video)[\\/][A-Za-z0-9_ .()'!@#$%^&+,\\/-]+\.(?:nif|dds|tri|bto|btr|hkx|xml|lip|fuz|wav|xwm|txt|pex|psc|seq))/gim;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalizeResourcePath(input) {
  if (typeof input !== 'string' || !input || input.length > 512 || /[\0\x01-\x1f\x7f]/.test(input)) {
    fail('INVALID_RESOURCE_PATH', 'Resource path is empty, oversized, or contains control bytes');
  }
  const slashed = input.replace(/\\/g, '/');
  if (slashed.startsWith('/') || /^[A-Za-z]:/.test(slashed) || slashed.includes(':')) {
    fail('UNSAFE_RESOURCE_PATH', `Absolute or device resource path is unsupported: ${input}`);
  }
  const parts = slashed.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    fail('UNSAFE_RESOURCE_PATH', `Traversal or empty segment in resource path: ${input}`);
  }
  return parts.join('/').toLowerCase();
}

/**
 * Bounded inspection of the actual SSE 20.2.0.7 NIF header and embedded
 * path-like strings. It is a reference scanner, not a full scene-graph parser:
 * block semantics/skin bindings must be established by native record facts or
 * an independent runtime/NifTools check. Every discovered path is returned.
 */
function inspectNif(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.length < NIF_HEADER.length + 16 || bytes.length > MAX_NIF) {
    fail('NIF_SIZE', `NIF byte length outside supported bounds (${bytes.length})`);
  }
  if (!bytes.subarray(0, NIF_HEADER.length).equals(NIF_HEADER)) {
    fail('NIF_HEADER', 'Unsupported NIF header; expected Skyrim SE 20.2.0.7');
  }
  const h = NIF_HEADER.length;
  if (bytes.readUInt32LE(h) !== 0x14020007 || bytes[h + 4] !== 1 || bytes.readUInt32LE(h + 5) !== 12) {
    fail('NIF_VERSION', 'Unsupported NIF byte order or user version');
  }
  const blockCount = bytes.readUInt32LE(h + 9);
  if (blockCount < 1 || blockCount > 65535) fail('NIF_BLOCK_COUNT', 'NIF block count outside supported bounds');

  // Texture/model paths are plain strings in Bethesda shader/model blocks.
  // Scan a Latin-1 view so byte offsets stay stable and decode only ASCII paths.
  const text = bytes.toString('latin1');
  const paths = new Map();
  PATH_RE.lastIndex = 0;
  for (let match; (match = PATH_RE.exec(text));) {
    const raw = match[1].replace(/\0+$/, '').trim();
    const canonicalRaw = /\.dds$/i.test(raw) && !/^textures[\\/]/i.test(raw) ? `textures/${raw}` : raw;
    let normalized;
    try { normalized = normalizeResourcePath(canonicalRaw); }
    catch (error) { if (error.code === 'UNSAFE_RESOURCE_PATH') throw error; continue; }
    paths.set(normalized, canonicalRaw.replace(/\\/g, '/'));
    if (paths.size > 512) fail('NIF_REFERENCE_LIMIT', 'NIF has more than 512 path references');
  }
  return {
    format: 'SkyrimSE-NIF-20.2.0.7',
    completeness: 'header-and-path-string-scan-only',
    sha256: hash(bytes),
    size: bytes.length,
    blockCount,
    references: [...paths].sort(([a], [b]) => a.localeCompare(b)).map(([normalized, sourcePath]) => ({ path: sourcePath, normalized }))
  };
}

function inspectDds(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.length < 128 || bytes.length > MAX_NIF || bytes.toString('ascii', 0, 4) !== 'DDS ' || bytes.readUInt32LE(4) !== 124 || bytes.readUInt32LE(76) !== 32) {
    fail('DDS_HEADER', 'Invalid or unsupported DDS header/size');
  }
  const height = bytes.readUInt32LE(12);
  const width = bytes.readUInt32LE(16);
  if (!width || !height || width > 32768 || height > 32768) fail('DDS_DIMENSIONS', 'DDS dimensions outside supported bounds');
  return { format: 'DDS', sha256: hash(bytes), size: bytes.length, width, height };
}

// NIF shader paths use Data\Textures in vanilla FaceGen as well as bare
// Actors\... strings. Normalize for the audit lookup only, never rewrite NIFs
// or claim this proves renderer path resolution. Reject traversal BEFORE strip.
function shaderTexturePath(input) {
  let value=normalizeResourcePath(input);
  if(value.startsWith('data/'))value=value.slice(5);
  if(!value.startsWith('textures/'))value='textures/'+value;
  if(!/^textures\/(actors|effects|cubemaps|shared|clutter|architecture|landscape|armor|weapons|dlc01|dlc02)\/.+\.dds$/.test(value))
    fail('SHADER_TEXTURE_PATH_UNSUPPORTED','Unrecognized shader texture root: '+input);
  return value;
}

// The two owner CK exports are RGBA8, one mip, exact row pitch. Other DDS
// formats remain supported by inspectDds's header diagnostic, but cannot be
// promoted under this narrow FaceTint validation contract.
function inspectFaceTintDds(input) {
  const b=Buffer.isBuffer(input)?input:Buffer.from(input),base=inspectDds(b);
  if(b.readUInt32LE(80)!==65||b.readUInt32LE(84)!==0||b.readUInt32LE(88)!==32||
     b.readUInt32LE(28)!==1||b.readUInt32LE(20)!==base.width*4||
     [92,96,100,104].some((offset,i)=>b.readUInt32LE(offset)!==[255,65280,16711680,4278190080][i])||
     b.length!==128+base.width*base.height*4)fail('FACE_TINT_DDS_FORMAT','Expected complete single-mip RGBA8 FaceTint DDS');
  return {...base,pixelFormat:'RGBA8',mipLevels:1,payloadValidated:true};
}

function safeLooseFile(root, relative) {
  const normalized = normalizeResourcePath(relative);
  const base = fs.realpathSync(root);
  const target = path.resolve(base, ...normalized.split('/'));
  if (target.toLowerCase() !== base.toLowerCase() && !target.toLowerCase().startsWith(base.toLowerCase() + path.sep.toLowerCase())) {
    fail('RESOURCE_ESCAPE', `Resource escaped Data root: ${relative}`);
  }
  let walk = base;
  for (const segment of normalized.split('/')) {
    walk = path.join(walk, segment);
    const stat = fs.lstatSync(walk, { throwIfNoEntry: false });
    if (!stat) return undefined;
    if (stat.isSymbolicLink() || stat.nlink !== 1) fail('RESOURCE_REDIRECT', `Redirected or hard-linked resource: ${relative}`);
  }
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size > MAX_NIF) fail('RESOURCE_FILE', `Invalid resource file: ${relative}`);
  const data = fs.readFileSync(target);
  return { source: 'loose', path: target, size: data.length, sha256: hash(data), data };
}

function buildArchiveLookup(dataRoot, approvedArchives) {
  const result = new Map();
  for (const archive of approvedArchives || []) {
    if (!archive || typeof archive !== 'object' || !/^Skyrim - [A-Za-z0-9 _.-]+\.bsa$/i.test(archive.filename || '') ||
        archive.indexer !== 'rsm-bsa' || archive.verified !== true || !/^[a-f0-9]{64}$/.test(archive.sha256 || '') ||
        !(archive.entries instanceof Map)) {
      fail('BSA_INDEX_UNVERIFIED', 'Archive index must come from a verified rsm-bsa read-only index of a base-game Skyrim BSA');
    }
    const archivePath = path.join(dataRoot, archive.filename);
    const st = fs.lstatSync(archivePath, { throwIfNoEntry: false });
    if (!st || !st.isFile() || st.isSymbolicLink() || st.nlink !== 1) fail('BSA_ARCHIVE_MISSING', `Approved base archive missing or redirected: ${archive.filename}`);
    // Hash through a stream so large archives are never read into memory.
    const dig = crypto.createHash('sha256');
    const fd = fs.openSync(archivePath, 'r');
    try {
      const chunk = Buffer.allocUnsafe(1024 * 1024);
      let n;
      while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) dig.update(chunk.subarray(0, n));
    } finally { fs.closeSync(fd); }
    if (dig.digest('hex') !== archive.sha256) fail('BSA_HASH_MISMATCH', `Approved archive changed since indexing: ${archive.filename}`);
    for (const member of archive.entries.keys()) {
      const key = normalizeResourcePath(member);
      if (result.has(key)) fail('BSA_AMBIGUOUS', `Resource is duplicated across approved base archives: ${member}`);
      result.set(key, archive.filename);
    }
  }
  return result;
}

function fieldList(record, name) {
  return (record.fields || []).filter(field => field.type === name).map(field => Buffer.from(field.data));
}
function oneField(record, name) {
  const values = fieldList(record, name);
  if (values.length > 1) fail('RECORD_FIELD_AMBIGUOUS', `Multiple ${name} fields in ${record.type}`);
  return values[0];
}
function formRefs(bytes, fieldName) {
  if (!bytes || bytes.length % 4 !== 0) fail('RECORD_FORM_FIELD', `Malformed ${fieldName} FormID list`);
  const refs = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const value = bytes.readUInt32LE(i);
    if (!value) fail('RECORD_FORM_FIELD', `Null FormID in ${fieldName}`);
    refs.push(value);
  }
  return refs;
}
function zstring(bytes, fieldName) {
  if (!bytes || bytes.length < 2 || bytes[bytes.length - 1] !== 0) fail('RECORD_PATH_FIELD', `Malformed ${fieldName} path field`);
  const value = bytes.subarray(0, bytes.indexOf(0)).toString('utf8');
  if (!value || value.includes('\ufffd')) fail('RECORD_PATH_FIELD', `Invalid UTF-8 in ${fieldName} path field`);
  return value;
}

/**
 * Create the callback accepted by Catalog Loader. `lookupRecord(ref)` returns
 * native libespm lookup records; each result's `toGlobalRecordId` maps fields.
 * Caller supplies `resolveGlobal(globalId)` to format plugin-qualified refs.
 * BSA indexes must include {filename,sha256,indexer:'rsm-bsa',verified:true,
 * entries:Map<relativePath,entryFacts>}; archive members are never extracted.
 */
function createResourceVerifier({ dataRoot, approvedArchives = [], approvedLooseFiles = new Map(), lookupRecord, resolveGlobal, nifSemanticVerifier, cache = new Map() }) {
  if (typeof lookupRecord !== 'function' || typeof resolveGlobal !== 'function') fail('RESOURCE_ADAPTER', 'Native lookupRecord and resolveGlobal callbacks are required');
  const root = fs.realpathSync(dataRoot);
  const archiveMembers = buildArchiveLookup(root, approvedArchives);
  const approvedLoose = new Map();
  const looseEntries = approvedLooseFiles instanceof Map ? approvedLooseFiles : Object.entries(approvedLooseFiles || {});
  for (const [name, value] of looseEntries) {
    const digest = typeof value === 'string' ? value : value && value.sha256;
    if (!/^[a-f0-9]{64}$/.test(digest || '')) fail('LOOSE_ALLOWLIST_INVALID', `Loose asset allowlist lacks a SHA256 for ${name}`);
    approvedLoose.set(normalizeResourcePath(name), digest);
  }
  let activeApprovedLoose = approvedLoose;
  function requireNifSemantic(bytes, scan, resourcePath) {
    if (typeof nifSemanticVerifier !== 'function') fail('NIF_SEMANTIC_VERIFIER_UNAVAILABLE', `No approved complete NIF semantic adapter for ${resourcePath}; bounded structure diagnostics alone do not establish full shader/skin closure`);
    const evidence = nifSemanticVerifier(bytes, { path: resourcePath, sha256: scan.sha256, scan });
    if (!evidence || evidence.parser !== 'nifly' || evidence.complete !== true || evidence.skinBindings !== true || evidence.textureReferencesComplete !== true ||
        !Array.isArray(evidence.references) || !Number.isInteger(evidence.blockCount) || evidence.blockCount !== scan.blockCount) {
      fail('NIF_SEMANTIC_EVIDENCE_INVALID', `NIF parser did not provide complete block, skin-binding and texture-reference evidence for ${resourcePath}`);
    }
    const required = new Set(scan.references.map(r => r.normalized));
    const resolved = new Map();
    for (const item of evidence.references) {
      if (!item || typeof item.path !== 'string') fail('NIF_SEMANTIC_EVIDENCE_INVALID', `Malformed NIF reference evidence for ${resourcePath}`);
      const normalized = normalizeResourcePath(item.path);
      resolved.set(normalized, item.path);
    }
    for (const path of required) if (!resolved.has(path)) fail('NIF_SEMANTIC_EVIDENCE_INCOMPLETE', `Structural parser omitted scanned reference ${path} in ${resourcePath}`);
    for (const item of resolved.values()) {
      const fact = resolvePath(item, new Set());
      // Keep the chain fail-closed: even the structural adapter's paths resolve
      // only to a pinned loose hash or an approved BSA member identity.
      if (fact.source === 'bsa' && /\.nif$/i.test(item)) fail('ARCHIVED_NIF_CONTENT_UNINSPECTED', `Archived NIF semantics were not independently parsed: ${item}`);
    }
  }
  function resolvePath(relative, stack) {
    const normalized = normalizeResourcePath(relative);
    const loose = safeLooseFile(root, relative);
    if (loose) {
      const expected = activeApprovedLoose.get(normalized);
      if (!expected || expected !== loose.sha256) fail('RESOURCE_LOOSE_UNAPPROVED', `Loose resource has no matching approved source SHA256 (possible override): ${relative}`);
    }
    if (!loose) {
      const archive = archiveMembers.get(normalized);
      if (!archive) fail('RESOURCE_MISSING', `Required resource is absent from loose Data and verified base-game BSA indexes: ${relative}`);
      const fact = { source: 'bsa', archive, path: normalized };
      if (/\.nif$/i.test(relative)) fail('ARCHIVED_NIF_CONTENT_UNINSPECTED', `Archive index confirms ${relative} exists but its NIF blocks/textures were not inspected`);
      return fact;
    }
    if (/\.nif$/i.test(relative)) {
      const parsed = cache.get(`nif:${loose.sha256}`) || inspectNif(loose.data);
      cache.set(`nif:${loose.sha256}`, parsed);
      requireNifSemantic(loose.data, parsed, relative);
      for (const ref of parsed.references) resolvePath(ref.path, stack);
    }
    return { source: 'loose', sha256: loose.sha256, size: loose.size, path: normalized };
  }
  function verifyResourceClosure(catalog) {
    activeApprovedLoose = new Map(approvedLoose);
    for (const asset of catalog.assets || []) {
      if (!asset || typeof asset.path !== 'string' || !asset.path.startsWith('Data/') || !/^[a-f0-9]{64}$/.test(asset.sha256 || '')) fail('ASSET_MANIFEST_PATH', 'Catalog asset requires a Data/ path and approved SHA256');
      const normalized = normalizeResourcePath(asset.path.slice(5));
      const prior = activeApprovedLoose.get(normalized);
      if (prior && prior !== asset.sha256) fail('RESOURCE_LOOSE_CONFLICT', `Catalog asset conflicts with approved loose source hash: ${asset.path}`);
      activeApprovedLoose.set(normalized, asset.sha256);
    }
    const visited = new Set();
    const resources = new Map();
    for (const asset of catalog.assets || []) {
      if (!asset || typeof asset.path !== 'string' || !asset.path.startsWith('Data/')) fail('ASSET_MANIFEST_PATH', 'Catalog asset path must start with Data/');
      const relative = asset.path.slice(5);
      const loose = safeLooseFile(root, relative);
      if (!loose || loose.size !== asset.size || loose.sha256 !== asset.sha256) fail('ASSET_MANIFEST_MISMATCH', `Staged catalog asset is missing or differs from its immutable manifest: ${asset.path}`);
      if (/\.dds$/i.test(relative)) {
        const parsed = inspectDds(loose.data);
        if (parsed.sha256 !== asset.sha256) fail('ASSET_MANIFEST_MISMATCH', `DDS manifest hash mismatch: ${asset.path}`);
        cache.set(`dds:${loose.sha256}`, parsed);
        resources.set(normalizeResourcePath(relative), { source: 'loose', sha256: loose.sha256, size: loose.size, path: normalizeResourcePath(relative) });
      } else if (/\.nif$/i.test(relative)) {
        const parsed = cache.get(`nif:${loose.sha256}`) || inspectNif(loose.data);
        cache.set(`nif:${loose.sha256}`, parsed);
        requireNifSemantic(loose.data, parsed, relative);
        resources.set(normalizeResourcePath(relative), { source: 'loose', sha256: loose.sha256, size: loose.size, path: normalizeResourcePath(relative) });
        for (const reference of parsed.references) {
          const resolved = resolvePath(reference.path, visited);
          resources.set(reference.normalized, resolved);
        }
      } else fail('ASSET_MANIFEST_TYPE', `Unsupported catalog asset type: ${asset.path}`);
    }
    const queue = [];
    const addRef = (ref, expectedType, from, field) => {
      if (!ref) fail('RESOURCE_REF_MISSING', `${from} has a null ${field} dependency`);
      queue.push({ ref, expectedType, from, field, depth: 0 });
    };
    for (const t of catalog.templates || []) {
      addRef(t.pluginQualifiedBaseId, 'NPC_', t.pluginQualifiedBaseId, 'base');
      addRef(t.appearance.race, 'RACE', t.pluginQualifiedBaseId, 'race');
      for (const part of t.appearance.headParts) addRef(part, 'HDPT', t.pluginQualifiedBaseId, 'head part');
      addRef(t.fixedOutfit.form, 'OTFT', t.pluginQualifiedBaseId, 'default outfit');
      for (const item of t.fixedOutfit.items) addRef(item, 'ARMO', t.fixedOutfit.form, 'outfit item');
    }
    const addRecordPath = (record, name) => {
      for (const bytes of fieldList(record, name)) {
        const raw = zstring(bytes, `${record.type}.${name}`);
        const resource = resolvePath(raw, visited);
        resources.set(normalizeResourcePath(raw), resource);
      }
    };
    while (queue.length) {
      const next = queue.shift();
      if (next.depth > MAX_GRAPH_DEPTH) fail('RESOURCE_GRAPH_DEPTH', `Dependency graph depth exceeded at ${next.ref}`);
      const key = `${next.expectedType}:${next.ref}`.toLowerCase();
      if (visited.has(key)) continue;
      if (visited.size >= MAX_GRAPH_RECORDS) fail('RESOURCE_GRAPH_LIMIT', 'Dependency graph exceeds 512 records');
      visited.add(key);
      const lookup = lookupRecord(next.ref);
      const record = lookup && lookup.record;
      if (!record || record.type !== next.expectedType) fail('RESOURCE_RECORD_MISSING', `${next.from} ${next.field} ${next.ref} is missing or is not ${next.expectedType}`);
      const map = local => {
        if (typeof lookup.toGlobalRecordId !== 'function') fail('RESOURCE_GLOBAL_ID', `Native lookup cannot map dependencies for ${next.ref}`);
        const global = lookup.toGlobalRecordId(local);
        if (!global) fail('RESOURCE_GLOBAL_ID', `Invalid dependency FormID in ${next.ref}`);
        return resolveGlobal(global);
      };
      const addFieldRefs = (field, expected, required = false) => {
        const values = fieldList(record, field);
        if (required && !values.length) fail('RESOURCE_REQUIRED_FIELD', `${record.type} ${next.ref} lacks required ${field} dependency`);
        for (const bytes of values) for (const id of formRefs(bytes, `${record.type}.${field}`)) queue.push({ ref: map(id), expectedType: expected, from: next.ref, field, depth: next.depth + 1 });
      };
      switch (record.type) {
        case 'NPC_':
          addFieldRefs('RNAM', 'RACE', true);
          addFieldRefs('PNAM', 'HDPT', true);
          addFieldRefs('DOFT', 'OTFT', true);
          break;
        case 'RACE':
          // Skyrim RACE WNAM is the skin ARMO; absence makes body/skin closure unknown.
          addFieldRefs('WNAM', 'ARMO', true);
          break;
        case 'OTFT': addFieldRefs('INAM', 'ARMO', true); break;
        case 'HDPT':
          addRecordPath(record, 'MODL');
          // TNAM is a TXST in Skyrim head parts when explicitly overridden.
          addFieldRefs('TNAM', 'TXST');
          break;
        case 'ARMO':
          // ARMO MODL entries are Armor Addon FormIDs in Skyrim.
          addFieldRefs('MODL', 'ARMA', true);
          break;
        case 'ARMA': {
          let pathFields = 0;
          for (const field of record.fields || []) {
            if (!/^MOD[2-9A-Z]$/.test(field.type)) continue;
            const bytes = Buffer.from(field.data);
            if (bytes.length && bytes[bytes.length - 1] === 0 && bytes.subarray(0, -1).every(b => b >= 0x20 && b <= 0x7e)) {
              const raw = zstring(bytes, `ARMA.${field.type}`);
              resources.set(normalizeResourcePath(raw), resolvePath(raw, visited));
              pathFields++;
            }
          }
          if (!pathFields) fail('RESOURCE_ARMA_MODELS_UNSUPPORTED', `ARMA ${next.ref} has no recognized male/female NIF model paths`);
          // MODT is a texture-set FormID list only when decoded by an established adapter;
          // no blind interpretation of unknown binary fields is allowed.
          break;
        }
        case 'TXST': {
          let pathCount = 0;
          for (const name of ['TX00', 'TX01', 'TX02', 'TX03', 'TX04', 'TX05', 'TX06', 'TX07']) {
            for (const bytes of fieldList(record, name)) {
              const raw = zstring(bytes, `TXST.${name}`);
              resources.set(normalizeResourcePath(raw), resolvePath(raw, visited));
              pathCount++;
            }
          }
          if (!pathCount) fail('RESOURCE_TXST_UNSUPPORTED', `TXST ${next.ref} has no recognized texture paths`);
          break;
        }
        default: fail('RESOURCE_RECORD_TYPE', `Unsupported resource dependency record type ${record.type} (${next.ref})`);
      }
      for (const [resourcePath, fact] of resources) {
        if (fact.source === 'bsa') continue;
        const loose = safeLooseFile(root, resourcePath);
        if (loose && /\.nif$/i.test(resourcePath)) {
          const parsed = cache.get(`nif:${loose.sha256}`) || inspectNif(loose.data);
          cache.set(`nif:${loose.sha256}`, parsed);
          for (const reference of parsed.references) resolvePath(reference.path, visited);
        }
      }
    }
    return { status: 'verified', recordCount: visited.size, resourceCount: resources.size, cacheEntries: cache.size, referencedResources: [...resources.keys()].sort() };
  }
  return verifyResourceClosure;
}

module.exports = { inspectNif, inspectDds, inspectFaceTintDds, shaderTexturePath, normalizeResourcePath, createResourceVerifier, MAX_NIF };
