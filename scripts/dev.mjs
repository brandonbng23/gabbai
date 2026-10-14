import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../backend/database/index.mjs';
import { ensureDemoUser } from '../backend/database/demo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const databasePath = process.env.GABBAI_DATABASE_PATH
    || fileURLToPath(new URL('../data/gabbai.dev.sqlite', import.meta.url));
let userId = process.env.GABBAI_DEV_USER_ID;
// Only the default development database receives sample records.
if (!process.env.GABBAI_DATABASE_PATH) {
    const database = openDatabase(databasePath);
    try {
        userId ??= ensureDemoUser(database).id;
    } finally {
        database.close();
    }
}

const port = process.env.PORT || '3000';
const env = { ...process.env, NODE_ENV: 'development', GABBAI_DATABASE_PATH: databasePath,
    GABBAI_API_TARGET: `http://127.0.0.1:${port}`, ...(userId ? { GABBAI_DEV_USER_ID: userId } : {}) };
console.log(`Development database: ${databasePath}`);
const children = [
    spawn(process.execPath, ['index.js'], { cwd: root, env, stdio: 'inherit' }),
    spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], {
        cwd: fileURLToPath(new URL('../frontend/', import.meta.url)), env, stdio: 'inherit',
    }),
];
let stopping = false;
function stop(code) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill('SIGTERM');
    setTimeout(() => {
        for (const child of children) {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        }
    }, 3000).unref();
}
for (const child of children) {
    child.on('error', error => { console.error(error.message); stop(1); });
    child.on('exit', code => stop(code ?? 1));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
