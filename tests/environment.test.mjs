import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const environmentModule = new URL('../backend/environment.mjs', import.meta.url).href;
const gmailModule = new URL('../backend/gmail.mjs', import.meta.url).href;

test('startup configuration loads quoted email settings without replacing host variables', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-env-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, '.env');
    writeFileSync(path, 'GMAIL_ENABLED="true"\nGMAIL_AUTH_MODE="app_password"\nGMAIL_USER="sender@example.com"\nGMAIL_APP_PASSWORD="abcdefghijklmnop"\nGMAIL_FROM_NAME="File name"\n');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GMAIL_')));
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { loadEnvironment } from ${JSON.stringify(environmentModule)};
        import { createGmailMailer } from ${JSON.stringify(gmailModule)};
        loadEnvironment(process.argv[1]);
        assert.equal(process.env.GMAIL_ENABLED, 'true');
        assert.equal(process.env.GMAIL_FROM_NAME, 'Host name');
        assert.equal(createGmailMailer({ createTransport: () => ({}) }).enabled, true);
    `, path], { cwd: directory, env: { ...env, GMAIL_FROM_NAME: 'Host name' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('startup works without an optional .env and surfaces other configuration read errors', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-env-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { loadEnvironment } from ${JSON.stringify(environmentModule)};
        assert.doesNotThrow(() => loadEnvironment(process.argv[1]));
        assert.throws(() => loadEnvironment(process.argv[2]));
    `, join(directory, 'missing.env'), directory], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
