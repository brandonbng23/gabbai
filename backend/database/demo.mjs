const demoDetails = {
    title: 'Mr.',
    hebrewName: 'Moshe ben Avraham',
    phone: '(202) 555-0100',
};

// Only these known sample identities receive placeholder profile details.
const dummyProfiles = [
    ['david.cohen@example.com', 'David ben Avraham'],
    ['sarah.levy@example.com', 'Sarah bat Miriam'],
    ['daniel.goldberg@example.com', 'Daniel ben Moshe'],
    ['rachel.friedman@example.com', 'Rachel bat Devorah'],
    ['benjamin.katz@example.com', 'Binyamin ben Yaakov'],
    ['rebecca.stein@example.com', 'Rivkah bat Sarah'],
    ['joshua.rosen@example.com', 'Yehoshua ben David'],
    ['miriam.weiss@example.com', 'Miriam bat Rachel'],
    ['aaron.schwartz@example.com', 'Aharon ben Shlomo'],
    ['leah.adler@example.com', 'Leah bat Channah'],
    ['samuel.greenberg@example.com', 'Shmuel ben Yosef'],
    ['hannah.klein@example.com', 'Channah bat Esther'],
    ['ethan.shapiro@example.com', 'Eitan ben Avraham'],
    ['naomi.silver@example.com', 'Naomi bat Rivkah'],
    ['noah.roth@example.com', 'Noach ben Yitzchak'],
    ['esther.bloom@example.com', 'Esther bat Miriam'],
    ['isaac.feldman@example.com', 'Yitzchak ben Yaakov'],
    ['abigail.stern@example.com', 'Avigail bat Sarah'],
    ['jonathan.segal@example.com', 'Yonatan ben David'],
    ['talia.berger@example.com', 'Talia bat Rachel'],
];

function fillMissingDetails(database, user, details) {
    const missing = Object.fromEntries(Object.entries(details).filter(([field]) => !user[field]));
    return Object.keys(missing).length ? database.updateUser(user.id, missing) : user;
}

// Shared sample identity for local development and explicitly enabled previews.
export function ensureDemoUser(database) {
    const profile = {
        name: 'Demo Shul',
        websiteUrl: 'https://demoshul.org',
        donationUrl: 'https://demoshul.org/contribute',
        email: 'shalom@demoshul.org',
        phone: '(443) 613-1818',
        address: '36 Khavish Road 21201 Baltimore, Maryland',
    };
    // Profile emails are editable. Reuse the reserved shul before considering
    // creation, including when the original sample account has been renamed.
    const demoShul = database.getShulByCode('DEMO');
    if (demoShul) database.removeUnusedDemoShuls();
    const emailMatch = database.getUserByEmail('demo@example.com');
    const existing = demoShul
        ? (emailMatch?.shulId === demoShul.id ? emailMatch : database.listShulUsers(demoShul.id)
            .filter(user => user.role !== 'guest')
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))[0])
        : emailMatch;
    if (existing) {
        if (!existing.shulId) return populateDemoProfiles(database, existing);
        database.ensureDemoShulCode(existing.shulId);
        const shul = database.getShul(existing.shulId);
        const changes = Object.fromEntries(Object.entries(profile)
            .filter(([field, value]) => shul[field] !== value));
        if (Object.keys(changes).length) database.updateShul(existing.shulId, changes);
        // Keep existing demo accounts in sync with the demo's administrator role.
        const demo = existing.role === 'admin' ? existing : database.updateUser(existing.id, { role: 'admin' });
        return populateDemoProfiles(database, demo);
    }
    const shul = demoShul ?? database.createShul({ ...profile, settings: { hebYear: 5787 } });
    database.ensureDemoShulCode(shul.id);
    const demo = database.createUser({
        shulId: shul.id,
        firstName: 'Demo',
        lastName: 'User',
        // An unrelated account may now own the original sample email.
        email: emailMatch ? `demo-${shul.id}@example.com` : 'demo@example.com',
        role: 'admin',
        ...demoDetails,
    });
    return populateDemoProfiles(database, demo);
}

function populateDemoProfiles(database, demo) {
    dummyProfiles.forEach(([email, hebrewName], index) => {
        const user = database.getUserByEmail(email);
        if (user && user.shulId === demo.shulId) {
            fillMissingDetails(database, user, {
                hebrewName,
                phone: `(202) 555-${String(101 + index).padStart(4, '0')}`,
            });
        }
    });
    return fillMissingDetails(database, demo, demoDetails);
}
