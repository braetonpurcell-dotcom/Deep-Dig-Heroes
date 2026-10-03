#!/usr/bin/env node
// Bundles the game into one self-contained HTML file (CSS, scripts and font inlined).
//   node tools/build-single.js out.html             full document, works when opened from a file
//   node tools/build-single.js out.html --fragment  page content only, for hosts that add their own <head>
//   node tools/build-single.js out.html --dir v2    bundle a test copy (beta/ or v2/) instead of the live game
const fs = require('fs');
const path = require('path');

const di = process.argv.indexOf('--dir');
const root = path.join(__dirname, '..', di > 0 ? process.argv[di + 1] : '');
const out = process.argv[2];
const fragment = process.argv.includes('--fragment');
if (!out) {
  console.error('usage: node tools/build-single.js <out.html> [--fragment]');
  process.exit(1);
}

const read = f => fs.readFileSync(path.join(root, f.split('?')[0]), 'utf8');
const html = read('index.html');
const font = fs.readFileSync(path.join(root, 'fonts/Jersey10-latin.woff2')).toString('base64');
const css = read('style.css').replace('url("fonts/Jersey10-latin.woff2")', `url(data:font/woff2;base64,${font})`);
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(f => `// ---- ${f}\n${read(f)}`).join('\n');

const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/\s*<script src="[^"]+"><\/script>/g, '');
const content = `${title}\n<style>\n${css}\n</style>\n${body.trim()}\n<script>\n${js}\n</script>\n`;

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/\s*<link rel="(manifest|icon|apple-touch-icon|stylesheet)"[^>]*>/g, '')
  .replace(/\s*<title>[\s\S]*?<\/title>/, '');
const doc = fragment
  ? content
  : `<!doctype html>\n<html lang="en">\n<head>${head}\n${title}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body.trim()}\n<script>\n${js}\n</script>\n</body>\n</html>\n`;

fs.writeFileSync(out, doc);
console.log(`wrote ${out} (${(doc.length / 1024).toFixed(0)} KB, ${scripts.length} scripts inlined${fragment ? ', fragment' : ''})`);
