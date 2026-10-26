'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const { structure } = require('./g241b-nif-structure.cjs');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

function faceMaterial(parsed) {
  const shaders = parsed.shaders.filter(s => s.shaderType === 4);
  return shaders.map(shader => {
    const set = parsed.textureSets.find(t => t.block === shader.textureSet);
    if (!set) throw new Error(`Shader ${shader.block} has no texture set`);
    return { block: shader.block, flags1: shader.flags1, flags2: shader.flags2,
      textures: Object.fromEntries(set.textures.map(t => [t.slot, t.path])) };
  });
}

function compareFacegen({ vanillaBytes, authoredBytes, expectedTintPath }) {
  const vanillaParsed = structure(vanillaBytes), authoredParsed = structure(authoredBytes);
  const vanillaFace = faceMaterial(vanillaParsed), authoredFace = faceMaterial(authoredParsed);
  if (vanillaFace.length !== 1 || authoredFace.length !== 1) throw new Error('Expected one face shader per NIF');
  const known = vanillaFace[0], actual = authoredFace[0];
  const norm = p => String(p || '').replaceAll('/', '\\').toLowerCase();
  const vanillaTint = known.textures[6] || '';
  const authoredTint = actual.textures[6] || '';
  const expected = norm(expectedTintPath);
  const pathIsExpected = norm(authoredTint) === expected;
  return {
    format: 'SSE 20.2.0.7 / BS100',
    vanilla: { sha256: sha256(vanillaBytes), shaderType: 4, flags1: known.flags1, flags2: known.flags2, tintPath: vanillaTint, detailPath: known.textures[3] || '' },
    authored: { sha256: sha256(authoredBytes), shaderType: 4, flags1: actual.flags1, flags2: actual.flags2, tintPath: authoredTint, detailPath: actual.textures[3] || '' },
    semantics: { matchingFaceShaderFlags: known.flags1 === actual.flags1 && known.flags2 === actual.flags2,
      vanillaTintPopulated: !!vanillaTint, authoredTintPopulated: !!authoredTint, authoredTintMatchesExpected: pathIsExpected,
      vanillaUsesDataTexturesPrefix: /^data[\\/]textures[\\/]/i.test(vanillaTint),
      authoredUsesDataTexturesPrefix: /^data[\\/]textures[\\/]/i.test(authoredTint) },
    staticAssessment: known.flags1 !== actual.flags1 || known.flags2 !== actual.flags2 ? 'BLOCKED_UNSUPPORTED_FORMAT' : !authoredTint ? 'PENDING_GAME_RENDER' : pathIsExpected ? 'PASS_STATIC' : 'BLOCKED_UNEXPECTED_TINT_PATH',
    staticScope: 'MATERIAL_FLAGS_AND_EXPECTED_PATH_FORM_ONLY',
    runtimePathAcceptance: 'PENDING_GAME_RENDER',
    limitations: ['One vanilla comparison establishes a matching FaceTint material pattern only; it does not prove engine fallback behavior or rendering.', 'NIF scene, geometry and skin binding are not covered by this narrow parser.', 'No binary was modified.']
  };
}

function compareFiles(vanillaPath, authoredPath, expectedTintPath) {
  return compareFacegen({ vanillaBytes: fs.readFileSync(vanillaPath), authoredBytes: fs.readFileSync(authoredPath), expectedTintPath });
}
module.exports = { faceMaterial, compareFacegen, compareFiles };
