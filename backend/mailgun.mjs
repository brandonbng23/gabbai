// Transport only. Which in-app messages should be emailed is deliberately TBD.
export function createMailgunMailer({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
    const enabled = env.MAILGUN_ENABLED?.trim().toLowerCase() === 'true';
    if (!enabled) return { enabled: false, async send() { return { status: 'disabled' }; } };

    const key = env.MAILGUN_API_KEY?.trim();
    const domain = env.MAILGUN_DOMAIN?.trim();
    const from = env.MAILGUN_FROM?.trim();
    const region = env.MAILGUN_REGION?.trim().toLowerCase() || 'us';
    if (!key || !domain || !from) throw new Error('Mailgun requires MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM.');
    if (!['us', 'eu'].includes(region)) throw new Error('MAILGUN_REGION must be us or eu.');
    if (!/^[a-z0-9.-]+$/i.test(domain) || /[\r\n]/.test(from)) throw new Error('Invalid Mailgun domain or sender configuration.');
    const host = region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';

    return {
        enabled: true,
        async send({ to, subject, text }) {
            // Send separately to each recipient; never expose a broadcast address list.
            if (typeof to !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) throw new TypeError('Provide one recipient email address.');
            if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject)) throw new TypeError('Provide a subject of 1–200 characters without newlines.');
            if (typeof text !== 'string' || !text.trim() || text.length > 20000) throw new TypeError('Provide email text of 1–20000 characters.');
            const form = new FormData();
            form.set('from', from);
            form.set('to', to);
            form.set('subject', subject.trim());
            form.set('text', text);
            let response;
            try {
                response = await fetchImpl(`${host}/v3/${encodeURIComponent(domain)}/messages`, {
                    method: 'POST',
                    headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}` },
                    body: form,
                    signal: AbortSignal.timeout(10000),
                });
            } catch {
                throw new Error('Mailgun request failed or timed out; delivery status is unknown.');
            }
            // Do not include provider response bodies, addresses, or credentials in errors.
            if (!response.ok) throw Object.assign(new Error(`Mailgun rejected the email (HTTP ${response.status}).`), { status: response.status });
            const result = await response.json().catch(() => null);
            if (typeof result?.id !== 'string' || !result.id) throw new Error('Mailgun returned an unexpected response; delivery status is unknown.');
            return { status: 'accepted', id: result.id };
        },
    };
}
