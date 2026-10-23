import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installSessionHistoryGuard } from '../frontend/src/sessionHistory.ts';

function setup() {
    const target = new EventTarget();
    let reloads = 0;
    target.location = { reload: () => reloads++ };
    const root = { style: { visibility: '' } };
    const cleanup = installSessionHistoryGuard(target, root);
    function navigate(type, persisted) {
        const event = new Event(type);
        Object.defineProperty(event, 'persisted', { value: persisted });
        target.dispatchEvent(event);
    }
    return { root, cleanup, navigate, reloads: () => reloads };
}

test('cached history pages are hidden and reload before authenticated UI can be reused', () => {
    const { root, navigate, reloads } = setup();
    navigate('pagehide', true);
    assert.equal(root.style.visibility, 'hidden');
    navigate('pageshow', true);
    assert.equal(root.style.visibility, 'hidden');
    assert.equal(reloads(), 1);
});

test('normal navigation does not hide the app or create a reload loop', () => {
    const { root, navigate, reloads } = setup();
    navigate('pagehide', false);
    navigate('pageshow', false);
    assert.equal(root.style.visibility, '');
    assert.equal(reloads(), 0);
});

test('restoration still reloads when pagehide was missed, and cleanup removes the guard', () => {
    const { root, cleanup, navigate, reloads } = setup();
    navigate('pageshow', true);
    assert.equal(root.style.visibility, 'hidden');
    assert.equal(reloads(), 1);
    cleanup();
    assert.equal(root.style.visibility, '');
    navigate('pagehide', true);
    navigate('pageshow', true);
    assert.equal(root.style.visibility, '');
    assert.equal(reloads(), 1);
});

test('same-document Back navigation rechecks sessions without duplicate reloads', () => {
    const { root, navigate, reloads } = setup();
    navigate('popstate', false);
    assert.equal(root.style.visibility, 'hidden');
    assert.equal(reloads(), 1);
    navigate('pageshow', true);
    navigate('popstate', false);
    assert.equal(reloads(), 1);
});
