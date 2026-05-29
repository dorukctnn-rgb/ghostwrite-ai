const fs = require('fs');
let p = JSON.parse(fs.readFileSync('package.json','utf8'));
p.main = 'server.js';
if(!p.scripts) p.scripts = {};
p.scripts.start = 'node server.js';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
console.log('reviewreply package.json duzeltildi');
