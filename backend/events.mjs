export function installEventRoutes(app, database) {
    const countClick = req => req.method === 'GET' && !`${req.get('purpose') ?? ''} ${req.get('sec-purpose') ?? ''}`.toLowerCase().includes('prefetch');
    function followLink(req, res, next, getDestination) {
        res.set('Cache-Control', 'no-store');
        try { return res.redirect(302, getDestination(countClick(req))); }
        catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
    }
    app.get('/api/shuls/:id/events/:eventId/register', (req, res, next) => followLink(req, res, next,
        count => database.eventRegistrationDestination(req.params.id, req.params.eventId, count)));
    app.get('/api/shuls/:id/donate', (req, res, next) => followLink(req, res, next,
        count => database.donationDestination(req.params.id, count)));
    app.get('/api/shuls/:id/events', (req, res, next) => {
        try { return res.set('Cache-Control', 'no-store').json(database.listShulEvents(req.params.id)); }
        catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
    });
    for (const method of ['post', 'patch', 'delete']) {
        app[method](`/api/shuls/:id/events${method === 'post' ? '' : '/:eventId'}`, (req, res, next) => {
            res.set('Cache-Control', 'no-store');
            if (!req.currentUserId) return res.status(401).json({ error: 'Sign in to manage events.' });
            try {
                if (method === 'delete') {
                    database.deleteShulEvent(req.params.id, req.currentUserId, req.params.eventId);
                    return res.sendStatus(204);
                }
                const event = method === 'post' ? database.createShulEvent(req.params.id, req.currentUserId, req.body)
                    : database.updateShulEvent(req.params.id, req.currentUserId, req.params.eventId, req.body);
                return res.status(method === 'post' ? 201 : 200).json(event);
            } catch (error) {
                if (error instanceof TypeError) return res.status(400).json({ error: error.message });
                if (error.status) return res.status(error.status).json({ error: error.message });
                next(error);
            }
        });
    }
}
