'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compareFacegen } = require('../../../scripts/g241c-facegen.cjs');
const vanillaPath = path.resolve(__dirname,'../../../../build/rp-audit/g241b/tools/vanilla-lydia.nif');
const data = 'C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition/Data/meshes/actors/character/FaceGenData/FaceGeom/FrostveilNPCTest.esp/';

test('vanilla female head demonstrates populated tint slot with matching FaceTint flags', () => {
  const r = compareFacegen({ vanillaBytes: fs.readFileSync(vanillaPath), authoredBytes: fs.readFileSync(data+'00005901.nif'), expectedTintPath: 'Data/Textures/actors/Character/FaceGenData/FaceTint/FrostveilNPCTest.esp/00005901.dds' });
  assert.equal(r.semantics.matchingFaceShaderFlags, true);
  assert.equal(r.semantics.vanillaTintPopulated, true);
  assert.equal(r.semantics.authoredTintPopulated, false);
  // A populated vanilla slot is a comparison, not proof that engine fallback
  // cannot supply this texture. Do not demand a CK re-export without evidence.
  assert.equal(r.staticAssessment, 'PENDING_GAME_RENDER');
});

test('vanilla and authored tint paths both use the accepted Data\\Textures string form', () => {
  const r = compareFacegen({ vanillaBytes: fs.readFileSync(vanillaPath), authoredBytes: fs.readFileSync(data+'00005906.nif'), expectedTintPath: 'Data/Textures/actors/Character/FaceGenData/FaceTint/FrostveilNPCTest.esp/00005906.dds' });
  assert.equal(r.semantics.vanillaUsesDataTexturesPrefix, true);
  assert.equal(r.semantics.authoredUsesDataTexturesPrefix, true);
  assert.equal(r.semantics.authoredTintMatchesExpected, true);
  assert.equal(r.staticAssessment, 'PASS_STATIC');
});

test('malformed NIF comparison fails closed', () => {
  assert.throws(() => compareFacegen({ vanillaBytes: Buffer.from('bad'), authoredBytes: Buffer.from('bad'), expectedTintPath: 'x' }));
});
