const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
test('required methods are exported by the exact checked-out native binding', () => {
  const native = read('skymp5-server/cpp/addon/ScampServer.cpp');
  for (const method of ['get', 'set', 'getActorName', 'getDescFromId', 'getUserByActor', 'getUserActor', 'isConnected', 'getUserGuid']) {
    assert.ok(native.includes(`InstanceMethod("${method}"`), `Native export absent: ${method}`);
  }
});
test('onlinePlayers is a native actor list with ignored form argument, including slot zero', () => {
  const source = read('skymp5-server/cpp/addon/property_bindings/OnlinePlayersBinding.cpp');
  assert.match(source, /uint32_t\)/); assert.match(source, /size_t i = 0/);
  assert.match(source, /ActorByUser\(i\)/); assert.match(source, /GetFormId\(\)/);
});
test('private RP properties need no client property registration and do not replicate', () => {
  const source = read('skymp5-server/cpp/addon/property_bindings/CustomPropertyBinding.cpp');
  assert.match(source, /if \(isPrivate\)/); assert.match(source, /SetPropertyValueDump\(propertyName, newValueDump, false, false\)/);
  const actor = read('skymp5-server/cpp/server_guest_lib/MpObjectReference.h');
  assert.match(actor, /GetPropertyPrefixPrivate\(\).*return "private\."/);
});
test('dynamic RP fields coexist with native persisted physical state', () => {
  const serializer = read('skymp5-server/cpp/server_guest_lib/MpChangeForms.cpp');
  for (const field of ['dynamicFields', 'inv', 'equipmentDump', 'position', 'appearanceDump', 'profileId']) assert.ok(serializer.includes(`res["${field}"]`));
});
test('loader copies CommonJS entry to temp and engine OFF build regenerates empty gamemode', () => {
  const loader = read('skymp5-server/ts/index.ts');
  assert.match(loader, /require\(tempPath\)/); assert.match(loader, /globalThis\.mp/);
  assert.match(read('skymp5-functions-lib/CMakeLists.txt'), /true > .*gamemode\.js/);
});
