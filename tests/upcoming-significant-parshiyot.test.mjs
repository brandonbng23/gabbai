import assert from 'node:assert/strict';
import { test } from 'node:test';
import { upcomingSignificantParshiyot } from '../frontend/src/upcomingSignificantParshiyot.ts';

const reading = (dateString, desc) => ({ dateString, desc });
const saved = portion => ({ portion, occasion: 'B’nai mitzvah' });

test('upcoming personal parshiyot are chronological, include today, exclude past and unrelated readings, and stop at three', () => {
    const readings = [reading('2026-12-05', 'Vayeshev'), reading('2026-11-09', 'Noach'),
        reading('2026-10-31', 'Bereshit'), reading('2026-11-21', 'Vayera'),
        reading('2026-11-14', 'Lech-Lecha'), reading('2026-12-12', 'Miketz'), reading('2026-11-10', 'Other')];
    const original = [...readings];
    const entries = ['Bereshit', 'Noach', 'Lech-Lecha', 'Vayera', 'Vayeshev', 'Miketz'].map(saved);
    assert.deepEqual(upcomingSignificantParshiyot(readings, entries, '2026-11-09').map(item => item.reading.desc),
        ['Noach', 'Lech-Lecha', 'Vayera']);
    assert.deepEqual(readings, original);
    assert.deepEqual(upcomingSignificantParshiyot(readings, [], '2026-11-09'), []);
});

test('combined readings match either parsha and group occasions without duplicate cards', () => {
    const readings = [reading('2026-11-14', 'Matot-Masei'), reading('2026-11-21', "Ha'azinu"), reading('2026-11-14', 'Matot-Masei')];
    const entries = [saved('Matot'), { portion: 'Masei', occasion: 'Anniversary' }, saved('Matot'), saved('Ha’azinu')];
    const matches = upcomingSignificantParshiyot(readings, entries, '2026-11-09');
    assert.equal(matches.length, 2);
    assert.deepEqual(matches[0].occasions, ['B’nai mitzvah', 'Anniversary']);
    assert.equal(matches[1].reading.desc, "Ha'azinu");
    assert.equal(upcomingSignificantParshiyot(readings, [saved('Mat')], '2026-11-09').length, 0, 'Partial names do not match');
    assert.equal(upcomingSignificantParshiyot([reading('2026-11-14', 'Matot')], [saved('Matot-Masei')], '2026-11-09').length, 1,
        'A saved combined parsha also matches when its portions are read separately');
});
