import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Settings } from '../core/settings.mts';
import { Schedule } from '../core/schedule.mts';
import { ReadingSet } from '../core/readingSet.mts';

const visibleAliyot = reading => reading.psukim.slice(0, 7)
    .filter(verses => verses && verses !== 'null').length;

test('Shmini is not labeled as Shmini Atzeret in notices or search terms', () => {
    const readings = new Schedule(new Settings(5787), 5787).getScheduleData();
    const shmini = readings.find(reading => reading.desc === 'Shmini');
    const atzeret = readings.find(reading => reading.desc === 'Shmini Atzeret Shabbat');
    assert.ok(shmini);
    assert.ok(!shmini.occassions.includes('Shmini Atzeret'));
    assert.ok(!shmini.searchTerms.includes('Shmini Atzeret'));
    assert.ok(atzeret.occassions.includes('Shmini Atzeret'));
});

test('numbered Chol HaMoed Shabbat names resolve their shared festival readings', () => {
    for (const tri of [false, true]) {
        for (const festival of ['Pesach', 'Sukkot']) {
            for (const day of ['III', 'IV', 'V', 'VI']) {
                const settings = new Settings(5787);
                settings.triennial.tri = tri;
                const desc = `${festival} ${day} Chol HaMoed Shabbat`;
                const reading = new ReadingSet(desc, 7, settings, [], 5787);
                const shared = new ReadingSet(`${festival} Chol HaMoed Shabbat`, 7, settings, [], 5787);
                const verses = reading.getPsukimArr();
                assert.ok(verses.every(value => value && value !== 'null'), `${desc}, tri=${tri}`);
                assert.deepEqual(verses, shared.getPsukimArr());
                assert.equal(reading.desc, desc);
            }
        }
    }
});

test('weekly schedule exposes the configured 1–7 aliyot plus maftir and haftarah', () => {
    for (let count = 1; count <= 7; count++) {
        const settings = new Settings(5787);
        settings.a = count;
        const readings = new Schedule(settings, 5787).getScheduleData();
        for (const desc of ["Ha'azinu", 'Bereshit']) {
            const weekly = readings.find(reading => reading.desc === desc);
            assert.equal(visibleAliyot(weekly), count, `${desc}: ${count} aliyot`);
            assert.ok(weekly.psukim[7] && weekly.psukim[7] !== 'null');
            assert.ok(weekly.psukim[8] && weekly.psukim[8] !== 'null');
        }
    }
});

test('High Holiday and Yontif counts respect their independent controls', () => {
    for (const hhRespect of [false, true]) {
        for (const yRespect of [false, true]) {
            const settings = new Settings(5787);
            Object.assign(settings, { a: 3, hhRespect, yRespect });
            const readings = new Schedule(settings, 5787).getScheduleData();
            for (const [desc, traditional, respect] of [
                ['Rosh Hashana Shabbat', 7, hhRespect],
                ['Rosh Hashana II', 5, hhRespect],
                ['Yom Kippur', 6, hhRespect],
                ['Sukkot I Shabbat', 7, yRespect],
                ['Sukkot II', 5, yRespect],
                ['Simchat Torah', 7, yRespect],
            ]) {
                const reading = readings.find(reading => reading.desc === desc);
                assert.ok(reading, desc);
                assert.equal(visibleAliyot(reading), respect ? traditional : 3,
                    `${desc}: hhRespect=${hhRespect}, yRespect=${yRespect}`);
            }
        }
    }
});

test('weekday holidays do not expose aliyot missing from their reading', () => {
    const settings = new Settings(5787);
    Object.assign(settings, { a: 7, hhRespect: false, yRespect: false });
    const readings = new Schedule(settings, 5787).getScheduleData();
    for (const [desc, count] of [['Rosh Hashana II', 5], ['Yom Kippur', 6], ['Sukkot II', 5]]) {
        assert.equal(visibleAliyot(readings.find(reading => reading.desc === desc)), count);
    }
});

test('Shmini Atzeret Shabbat has readings in traditional and triennial modes', () => {
    for (const tri of [false, true]) {
        for (const year of [5786, 5787, 5788]) {
            const settings = new Settings(year);
            settings.triennial.tri = tri;
            const reading = new ReadingSet('Shmini Atzeret Shabbat', 7, settings, [], year);
            const verses = reading.getPsukimArr();
            assert.ok(verses.every(value => value && value !== 'null'), `${year}, tri=${tri}`);
            assert.equal(reading.getBook(), 'Yontifs');
        }
    }
});

test('book categories ignore hidden aliyot and special maftir', () => {
    for (const tri of [false, true]) {
        for (const count of [3, 7]) {
            const settings = new Settings(5787);
            settings.a = count;
            settings.triennial.tri = tri;
            const readings = new Schedule(settings, 5787).getScheduleData();
            for (const [desc, book] of [
                ['Bereshit', 'Genesis'], ['Vayeshev', 'Genesis'], ['Shemot', 'Exodus'], ['Vayikra', 'Leviticus'],
                ['Bamidbar', 'Numbers'], ['Devarim', 'Deuteronomy'],
                ['Shmini Atzeret Shabbat', 'Yontifs'], ['Rosh Hashana II', 'Yontifs'],
            ]) {
                assert.equal(readings.find(reading => reading.desc === desc)?.book, book,
                    `${desc}, count=${count}, tri=${tri}`);
            }
            assert.ok(readings.every(reading => reading.book), 'Every reading has a book category');
            const special = new ReadingSet('Bereshit', count, settings, ['Shabbat Rosh Chodesh'], 5787);
            assert.equal(special.getBook(), 'Genesis');
        }
    }
});
