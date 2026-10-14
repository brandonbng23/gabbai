import { Settings } from '../../core/settings.mts';

export function requireObject(value, name) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
        throw new TypeError(`${name} must be a plain object`);
    }
}

export function validateKeys(value, allowed, name) {
    requireObject(value, name);
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) throw new TypeError(`Unknown ${name} field: ${key}`);
    }
}

// Preserve the scheduling engine's field names and defaults in storage.
export function mergeShulSettings(current, patch = {}) {
    validateKeys(patch, Object.keys(current), 'shul settings');
    const merged = { ...current, ...patch };
    for (const key of ['yontifs', 'triennial']) {
        const changes = Object.hasOwn(patch, key) ? patch[key] : {};
        validateKeys(changes, Object.keys(current[key]), key);
        merged[key] = { ...current[key], ...changes };
        for (const value of Object.values(merged[key])) {
            if (typeof value !== 'boolean') throw new TypeError(`${key} values must be booleans`);
        }
    }
    for (const key of ['il', 'hhRespect', 'yRespect', 'specialSeventh']) {
        if (typeof merged[key] !== 'boolean') throw new TypeError(`${key} must be a boolean`);
    }
    if (!Number.isInteger(merged.hebYear) || merged.hebYear < 1 || merged.hebYear > 9999) {
        throw new TypeError('hebYear must be an integer between 1 and 9999');
    }
    if (!Number.isInteger(merged.a) || merged.a < 1 || merged.a > 7) {
        throw new TypeError('a must be an integer between 1 and 7');
    }
    if (merged.triennial.triMaftir && merged.triennial.tradMaftir) {
        throw new TypeError('Choose at most one maftir reading pattern');
    }
    return merged;
}

export function defaultShulSettings(year) {
    if (year === undefined) throw new TypeError('A shul must specify its active hebYear');
    return mergeShulSettings(JSON.parse(JSON.stringify(new Settings(year))), { hebYear: year });
}

export function settingsForSchedule(stored) {
    const values = mergeShulSettings(defaultShulSettings(stored.hebYear), stored);
    return Object.assign(new Settings(values.hebYear), values);
}

export function serializeUserSettings(value) {
    requireObject(value, 'user settings');
    return JSON.stringify(value, (_key, entry) => {
        if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol'
            || (typeof entry === 'number' && !Number.isFinite(entry))) {
            throw new TypeError('User settings must contain JSON values');
        }
        return entry;
    });
}
