import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parshaForSignificantDate, parseSignificantDate } from '../core/significantDate.mts';

test('Gregorian significant dates use the upcoming Shabbat, include Shabbat itself, and cross Gregorian years', () => {
    for (const date of ['2026-11-08', '2026-11-09', '2026-11-13', '2026-11-14']) {
        assert.deepEqual(parshaForSignificantDate(date), { portion: 'Toldot', shabbatDate: '2026-11-14' });
    }
    assert.deepEqual(parshaForSignificantDate('2025-12-31'), { portion: 'Vayechi', shabbatDate: '2026-01-03' });
    assert.deepEqual(parshaForSignificantDate('2026-07-11'), { portion: 'Matot-Masei', shabbatDate: '2026-07-11' });
});

test('significant dates honor Israel/Diaspora and explain festival Shabbatot', () => {
    assert.deepEqual(parshaForSignificantDate('2026-05-23', true), { portion: 'Nasso', shabbatDate: '2026-05-23' });
    assert.throws(() => parshaForSignificantDate('2026-05-23', false), /festival reading \(Shavuot\)/);
    assert.throws(() => parshaForSignificantDate('2026-04-04'), /festival reading/);
});

test('invalid Gregorian dates are rejected rather than rolled over', () => {
    for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '0000-01-01', '2026-11-00', '', '11/09/2026', null]) {
        assert.throws(() => parseSignificantDate(date), /valid Gregorian date/);
    }
    assert.equal(parseSignificantDate('2024-02-29').getDate(), 29);
});
