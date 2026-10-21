const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const target = path.join(path.dirname(process.env.DB_PATH), 'backup.db');
fs.rmSync(target, { force: true });
db.exec(`VACUUM INTO '${target}'`);
console.log(`Backed up to ${target}`);
