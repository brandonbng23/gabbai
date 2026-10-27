import { validateKeys } from './database/settings.mjs';

export function installMessaging(app, database) {
    function route(work) {
        return (req, res, next) => {
            res.set('Cache-Control', 'no-store');
            if (!req.currentUserId) return res.status(401).json({ error: 'Sign in to use messages.' });
            try {
                const result = work(req);
                return res.status(req.method === 'POST' ? 201 : 200).json(result);
            } catch (error) {
                if (error instanceof TypeError) return res.status(400).json({ error: error.message });
                if (error.status) return res.status(error.status).json({ error: error.message });
                return next(error);
            }
        };
    }
    function query(req) {
        validateKeys({ ...req.query }, ['limit', 'offset', 'folder'], 'message query');
        const result = {};
        for (const key of ['limit', 'offset']) {
            if (req.query[key] === undefined) continue;
            if (typeof req.query[key] !== 'string' || !/^\d+$/.test(req.query[key]))
                throw new TypeError(`${key} must be an integer.`);
            result[key] = Number(req.query[key]);
        }
        if (req.query.folder !== undefined) result.folder = req.query.folder;
        return result;
    }
    app.get('/api/me/messages', route(req => database.listUserMessages(req.currentUserId, query(req))));
    app.post('/api/me/messages', route(req => {
        const shulId = database.getUser(req.currentUserId)?.shulId;
        return database.sendUserMessage(req.currentUserId, shulId, req.body);
    }));
    app.patch('/api/me/messages/:messageId/read', route(req => {
        validateKeys(req.body, [], 'read receipt');
        return database.markUserMessageRead(req.currentUserId, req.params.messageId);
    }));
    app.get('/api/shuls/:id/messages', route(req => database.listShulMessages(req.currentUserId, req.params.id, query(req))));
    app.post('/api/shuls/:id/messages', route(req => database.sendShulMessage(req.currentUserId, req.params.id, req.body)));
    app.patch('/api/shuls/:id/messages/:messageId/read', route(req => {
        validateKeys(req.body, [], 'read receipt');
        return database.markShulMessageRead(req.currentUserId, req.params.id, req.params.messageId);
    }));
}
