import { HDate } from '@hebcal/core';
import { getShulSchedule } from './schedule.mjs';
import { monthBounds, monthlyEngagement } from '../core/monthlyEngagement.mts';

function hebrewYear(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(2000, 0, 1, 12);
    date.setFullYear(year, month - 1, day);
    return new HDate(date).getFullYear();
}

export function compareEngagementMonths(first, second, loadYear) {
    const ranges = [monthBounds(first), monthBounds(second)];
    const years = new Set();
    for (const range of ranges) for (let year = hebrewYear(range.start); year <= hebrewYear(range.last); year++) {
        if (year < 1 || year > 9999) throw new TypeError('This month is outside the supported calendar range.');
        years.add(year);
    }
    const schedule = [...years].flatMap(year => loadYear(year));
    return { first: monthlyEngagement(schedule, first), second: monthlyEngagement(schedule, second) };
}

export function installAnalyticsRoutes(app, database) {
    app.get('/api/shuls/:id/analytics/monthly', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const actor = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!actor) return res.status(401).json({ error: 'Sign in to view shul analytics.' });
        if (actor.role !== 'admin' || actor.shulId !== req.params.id)
            return res.status(403).json({ error: 'Only this shul’s administrators can view analytics.' });
        try {
            return res.json(compareEngagementMonths(req.query.first, req.query.second, year => getShulSchedule(database, req.params.id, year)));
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            next(error);
        }
    });
}
