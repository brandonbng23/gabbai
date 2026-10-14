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
    const existing = database.getUserByEmail('demo@example.com');
    if (existing) {
        const shul = database.getShul(existing.shulId);
        const changes = Object.fromEntries(Object.entries(profile)
            .filter(([field, value]) => shul[field] !== value));
        if (Object.keys(changes).length) database.updateShul(existing.shulId, changes);
        return existing;
    }
    const shul = database.createShul({ ...profile, settings: { hebYear: 5787 } });
    return database.createUser({
        shulId: shul.id,
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
        role: "admin"
    });
}
