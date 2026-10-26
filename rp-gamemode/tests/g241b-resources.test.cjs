'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { inspectNif, inspectDds, normalizeResourcePath, createResourceVerifier } = require('../scripts/g241b-resources.cjs');

function nifWithStrings(strings = []) {
  const header = Buffer.from('Gamebryo File Format, Version 20.2.0.7\n', 'ascii');
  const rest = Buffer.alloc(16);
  rest.writeUInt32LE(0x14020007, 0);
  rest[4] = 1;
  rest.writeUInt32LE(12, 5);
  rest.writeUInt32LE(1, 9);
  return Buffer.concat([header, rest, Buffer.from(strings.join('\0') + '\0', 'ascii')]);
}

test('inspectNif validates SSE header and extracts embedded mesh/texture paths', () => {
  const result = inspectNif(nifWithStrings(['textures\\actors\\character\\female\\FemaleHead.dds', 'meshes\\actors\\character\\hair\\HairLong.nif']));
  assert.equal(result.format, 'SkyrimSE-NIF-20.2.0.7');
  assert.equal(result.blockCount, 1);
  assert.deepEqual(result.references.map(ref => ref.normalized), [
    'meshes/actors/character/hair/hairlong.nif',
    'textures/actors/character/female/femalehead.dds'
  ]);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('inspectNif rejects unsupported headers and invalid path traversal', () => {
  assert.throws(() => inspectNif(Buffer.alloc(80)), { code: 'NIF_HEADER' });
  assert.throws(() => normalizeResourcePath('textures/../outside.dds'), { code: 'UNSAFE_RESOURCE_PATH' });
  assert.throws(() => normalizeResourcePath('C:/outside.dds'), { code: 'UNSAFE_RESOURCE_PATH' });
  assert.throws(() => inspectNif(nifWithStrings(['textures\\..\\outside.dds'])), { code: 'UNSAFE_RESOURCE_PATH' });
});

test('inspectDds validates a bounded DDS header and dimensions', () => {
  const bytes = Buffer.alloc(128);
  bytes.write('DDS ', 0, 'ascii');
  bytes.writeUInt32LE(124, 4);
  bytes.writeUInt32LE(64, 12);
  bytes.writeUInt32LE(64, 16);
  bytes.writeUInt32LE(32, 76);
  assert.deepEqual({ width: inspectDds(bytes).width, height: inspectDds(bytes).height }, { width: 64, height: 64 });
  assert.throws(() => inspectDds(Buffer.alloc(128)), { code: 'DDS_HEADER' });
});

test('resource verifier reaches NIF semantic gate and refuses scanner-only closure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-g241b-resources-'));
  try {
    const addFile = (relative, bytes) => { const file = path.join(root, ...relative.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
    const model = nifWithStrings(['textures\\actors\\character\\female\\FemaleHead.dds']);
    addFile('meshes/actors/character/FaceGenData/FaceGeom/FrostveilNPCTest.esp/00005901.nif', model);
    addFile('meshes/actors/character/armor/test.nif', model);
    addFile('textures/actors/character/female/FemaleHead.dds', Buffer.from('fixture DDS placeholder'));
    const bytes = (field, value) => ({ type: field, data: Buffer.from(value) });
    const form = (field, id) => bytes(field, Buffer.from(new Uint32Array([id]).buffer));
    const str = (field, value) => bytes(field, Buffer.from(value + '\0'));
    const records = new Map([
      ['100:Owned.esp', { type: 'NPC_', fields: [form('RNAM', 101), form('PNAM', 102), form('DOFT', 103)] }],
      ['101:Skyrim.esm', { type: 'RACE', fields: [form('WNAM', 105)] }],
      ['102:Owned.esp', { type: 'HDPT', fields: [str('MODL', 'meshes/actors/character/FaceGenData/FaceGeom/FrostveilNPCTest.esp/00005901.nif')] }],
      ['103:Owned.esp', { type: 'OTFT', fields: [form('INAM', 104)] }],
      ['104:Skyrim.esm', { type: 'ARMO', fields: [form('MODL', 106)] }],
      ['105:Skyrim.esm', { type: 'ARMO', fields: [form('MODL', 106)] }],
      ['106:Skyrim.esm', { type: 'ARMA', fields: [str('MOD2', 'meshes/actors/character/armor/test.nif')] }]
    ]);
    const lookupRecord = ref => { const record = records.get(ref); return record && { record, toGlobalRecordId: id => id }; };
    const sha = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, ...relative.split('/')))).digest('hex');
    const approvedLooseFiles = new Map(['meshes/actors/character/FaceGenData/FaceGeom/FrostveilNPCTest.esp/00005901.nif', 'meshes/actors/character/armor/test.nif', 'textures/actors/character/female/FemaleHead.dds'].map(relative => [relative, sha(relative)]));
    const verify = createResourceVerifier({ dataRoot: root, approvedLooseFiles, lookupRecord, resolveGlobal: id => ({ 101: '101:Skyrim.esm', 102: '102:Owned.esp', 103: '103:Owned.esp', 104: '104:Skyrim.esm', 105: '105:Skyrim.esm', 106: '106:Skyrim.esm' })[id] });
    const catalog = { templates: [{ pluginQualifiedBaseId: '100:Owned.esp', appearance: { race: '101:Skyrim.esm', headParts: ['102:Owned.esp'] }, fixedOutfit: { form: '103:Owned.esp', items: ['104:Skyrim.esm'] } }] };
    assert.throws(() => verify(catalog), { code: 'NIF_SEMANTIC_VERIFIER_UNAVAILABLE' });
    const blocked = createResourceVerifier({ dataRoot: root, lookupRecord, resolveGlobal: id => String(id) });
    assert.throws(() => blocked(catalog), { code: 'RESOURCE_LOOSE_UNAPPROVED' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resource verifier fails closed without actual verified base archive indexes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-g241b-bsa-'));
  try {
    assert.throws(() => createResourceVerifier({ dataRoot: root, approvedArchives: [{ filename: 'Skyrim - Textures0.bsa' }], lookupRecord() {}, resolveGlobal() {} }), { code: 'BSA_INDEX_UNVERIFIED' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
