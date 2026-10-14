// Shared sample identity for local development and explicitly enabled previews.
export function ensureDemoUser(database) {
    const existing = database.getUserByEmail('demo@example.com');
    if (existing) return existing;
    const shul = database.createShul({ name: 'Demo Shul', settings: { hebYear: 5787 } });
    return database.createUser({
        shulId: shul.id,
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
    });
}
