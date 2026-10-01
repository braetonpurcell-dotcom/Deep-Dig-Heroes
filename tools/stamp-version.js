// Stamps ?v=<GAME_VERSION> onto every script and stylesheet in index.html.
// Run after changing js/version.js: node tools/stamp-version.js   (or: node tools/stamp-version.js beta)
const fs = require('fs');
const path = require('path');
const root = path.resolve(path.join(__dirname, '..'), process.argv[2] || '.');
const v = /GAME_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'))[1];
const file = path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8')
  .replace(/(<script src="js\/[\w-]+\.js)(\?v=[^"]*)?"/g, `$1?v=${v}"`)
  .replace(/(<link rel="stylesheet" href="style\.css)(\?v=[^"]*)?"/g, `$1?v=${v}"`);
fs.writeFileSync(file, html);
console.log(path.relative(process.cwd(), file) || file, 'stamped with', v);
