import { createApp } from './app.mjs';

const app = createApp();
const trashCleanup = setInterval(() => {
    try { app.locals.database.purgeExpiredMessages(); }
    catch (error) { console.error('Trash cleanup failed:', error); }
}, 60 * 60 * 1000);
trashCleanup.unref();
const port = process.env.PORT || 3000;
const host = process.env.NODE_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';
const server = app.listen(port, host, () => {
    console.log(`Backend running at http://localhost:${port}`);
});

function shutdown() {
    clearInterval(trashCleanup);
    server.close(() => {
        app.locals.database.close();
    });
    setTimeout(() => process.exit(1), 3000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
