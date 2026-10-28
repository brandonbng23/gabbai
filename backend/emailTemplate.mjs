import { readFileSync } from 'node:fs';

const footer = 'This is an automated notification. Please respond through Gabbai.';

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}

function inboxLink(publicUrl) {
    if (!publicUrl?.trim()) return null;
    let url;
    try { url = new URL(publicUrl.trim()); }
    catch { throw new Error('GABBAI_PUBLIC_URL must be an absolute http or https URL.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('GABBAI_PUBLIC_URL must be an absolute http or https URL without credentials.');
    }
    return new URL('/messages', url).href;
}

// Layout and styling live in the HTML file. Escape all dynamic content here.
export function emailTemplate(subject, text, { publicUrl = '' } = {}) {
    const inboxUrl = inboxLink(publicUrl);
    const content = text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(paragraph =>
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#45434b;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`
    ).join('');
    const values = {
        title: escapeHtml(subject),
        preheader: escapeHtml(text.replace(/\s+/g, ' ').trim().slice(0, 160)),
        content,
        footer: escapeHtml(footer),
        inboxUrl: escapeHtml(inboxUrl ?? ''),
    };
    const layout = readFileSync(new URL('./emailTemplate.html', import.meta.url), 'utf8');
    return layout
        .replace(/<!-- IF_INBOX -->([\s\S]*?)<!-- END_IF_INBOX -->/g, (_, button) => inboxUrl ? button : '')
        .replace(/\{\{(title|preheader|content|footer|inboxUrl)\}\}/g, (_, key) => values[key]);
}

export function emailText(text, { publicUrl = '' } = {}) {
    const url = inboxLink(publicUrl);
    return `${text}${url ? `\n\nOpen Gabbai: ${url}` : ''}\n\n${footer}`;
}
