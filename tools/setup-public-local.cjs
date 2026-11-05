const fs = require('node:fs');
const keys = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
if (keys.some((key) => !process.env[key]))
  throw new Error('Load the public Supabase configuration first.');
const file = '.env.local';
const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const retained = current
  .split(/\r?\n/)
  .filter((line) => !keys.some((key) => line.startsWith(key + '=')))
  .join('\n');
fs.writeFileSync(
  file,
  retained.trimEnd() +
    '\n' +
    keys.map((key) => key + '=' + JSON.stringify(process.env[key])).join('\n') +
    '\n',
);
console.log('Updated only the two public Supabase values in ignored .env.local.');
