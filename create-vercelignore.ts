import fs from 'fs';
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const vercelignore = gitignore + '\n# Ignore old API files\napi/*\n!api/index.ts\n';
fs.writeFileSync('.vercelignore', vercelignore);
