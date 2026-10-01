// Stamps ?v=<GAME_VERSION> onto every script and stylesheet in index.html.
// Run after changing js/version.js: node tools/stamp-version.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const v = /GAME_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'))[1];
const file = path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8')
  .replace(/(<script src="js\/[\w-]+\.js)(\?v=[^"]*)?"/g, `$1?v=${v}"`)
  .replace(/(<link rel="stylesheet" href="style\.css)(\?v=[^"]*)?"/g, `$1?v=${v}"`);
fs.writeFileSync(file, html);
console.log('index.html stamped with', v);
