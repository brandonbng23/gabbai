import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { openDatabase } from '../backend/database/index.mjs';

async function availablePort() {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

test('combined startup proxies saved profiles and stops both servers', { timeout: 20000 }, async t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-dev-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const filename = join(directory, 'dev.sqlite');
    const db = openDatabase(filename);
    const shul = db.createShul({ name: 'Startup Test Shul', settings: { hebYear: 5788 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Startup', lastName: 'User', email: 'startup@example.com' });
    db.close();
    const backendPort = await availablePort();
    const frontendPort = await availablePort();
    const child = spawn(process.execPath, ['scripts/dev.mjs', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...process.env, PORT: String(backendPort), GABBAI_DATABASE_PATH: filename, GABBAI_DEV_USER_ID: user.id },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = once(child, 'exit');
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM');
            await exited;
        }
    });
    const base = `http://127.0.0.1:${frontendPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(output);
        try {
            const response = await fetch(`${base}/api/me`, { signal: AbortSignal.timeout(1000) });
            if (response.ok) { ready = true; break; }
        } catch { /* Both processes may still be starting. */ }
        await delay(100);
    }
    assert.ok(ready, output);
    assert.equal((await (await fetch(`${base}/api/me`)).json()).id, user.id);
    const passwordSetup = await fetch(`${base}/api/auth/password`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ password: 'Development test password!' }) });
    assert.equal(passwordSetup.status, 200, 'Same-origin auth requests must work through the Vite proxy');
    const session = passwordSetup.headers.getSetCookie()[0].split(';')[0];
    const signedOut = await fetch(`${base}/api/auth/signout`, { method: 'POST', headers: { Cookie: session, Origin: base } });
    assert.equal(signedOut.status, 204);
    const loggedOutCookie = signedOut.headers.getSetCookie()[0].split(';')[0];
    assert.equal((await fetch(`${base}/api/me`, { headers: { Cookie: loggedOutCookie } })).status, 401);
    assert.deepEqual(await (await fetch(`${base}/api/shuls`)).json(), [{ id: shul.id, name: shul.name }]);
    const readings = await (await fetch(`${base}/api/schedule?shul=${shul.id}`)).json();
    assert.ok(readings.length > 0);
    assert.ok(readings.every(reading => reading.hDate.includes('5788')));
    assert.equal((await fetch(base)).status, 200);
    child.kill('SIGTERM');
    const [code] = await exited;
    assert.equal(code, 0, output);
    await assert.rejects(fetch(`${base}/api/me`));
    await assert.rejects(fetch(`http://127.0.0.1:${backendPort}/api/test`));
});

test('a frontend startup failure also stops the backend', { timeout: 15000 }, async t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-dev-failure-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const occupied = createServer();
    occupied.listen(0, '127.0.0.1');
    await once(occupied, 'listening');
    t.after(() => new Promise(resolve => occupied.close(resolve)));
    const backendPort = await availablePort();
    const child = spawn(process.execPath, ['scripts/dev.mjs', '--host', '127.0.0.1', '--port', String(occupied.address().port), '--strictPort'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...process.env, PORT: String(backendPort), GABBAI_DATABASE_PATH: join(directory, 'dev.sqlite') },
        stdio: 'ignore',
    });
    const exited = once(child, 'exit');
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM');
            await exited;
        }
    });
    const [code] = await exited;
    assert.notEqual(code, 0);
    await assert.rejects(fetch(`http://127.0.0.1:${backendPort}/api/test`));
});
