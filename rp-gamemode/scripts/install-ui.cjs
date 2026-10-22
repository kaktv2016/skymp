// User-executed only. Adds one isolated HTML page; never replaces existing UI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
function installUi(source, game) {
  const gameDir = path.resolve(game);
  if (!fs.existsSync(path.join(gameDir, 'SkyrimSE.exe'))) throw new Error('Game directory must contain SkyrimSE.exe');
  const destination = path.join(gameDir, 'Data/Platform/UI/rp-chat/index.html');
  for (let current = destination; current !== path.dirname(gameDir); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Refusing redirected UI destination');
  }
  const logDirectory=path.join(gameDir,'Data/Platform/Logs');
  if(fs.existsSync(logDirectory) && fs.lstatSync(logDirectory).isSymbolicLink()) throw new Error('Refusing redirected diagnostic log directory');
  fs.mkdirSync(logDirectory,{recursive:true});
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (fs.existsSync(destination)) {
    if (hash(destination) !== hash(source)) throw new Error('Different chat UI already exists; preserve and review it before updating');
    return { destination, url:pathToFileURL(destination).href, action:'KEEP_IDENTICAL' };
  }
  fs.mkdirSync(path.dirname(destination), { recursive:true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  return { destination, url:pathToFileURL(destination).href, action:'ADD' };
}
module.exports = { installUi };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--game-dir')) throw new Error('Usage: install-ui.cjs [--game-dir GAME_DIRECTORY]');
    const game = args[1] || 'C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition';
    console.log(JSON.stringify(installUi(path.resolve(__dirname, '../dist/client-ui/index.html'), game), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
