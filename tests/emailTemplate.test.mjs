import test from 'node:test';
import assert from 'node:assert/strict';
import { emailTemplate, emailText } from '../backend/emailTemplate.mjs';

test('Email templates escape user content and preserve paragraphs and line breaks', () => {
    const html = emailTemplate('Reading <confirmed> & booked', 'Hello <script>alert("x")</script>\r\nAliyah: 3\r\n\r\nThank you & welcome.');
    assert.match(html, /Reading &lt;confirmed&gt; &amp; booked/);
    assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<br>Aliyah: 3/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /Thank you &amp; welcome/);
    assert.doesNotMatch(html, /<a\b[^>]*href=/);
});

test('Emails link to the configured app inbox and include an equivalent plain-text fallback', () => {
    const options = { publicUrl: 'https://gabbai.example/?from=email&other=value' };
    assert.match(emailTemplate('Summary', 'Upcoming readings', options), /href="https:\/\/gabbai.example\/messages"/);
    assert.equal(emailText('Upcoming readings', options), 'Upcoming readings\n\nOpen Gabbai: https://gabbai.example/messages\n\nThis is an automated notification. Please respond through Gabbai.');
});

test('Email links reject script URLs and credentials rather than embedding unsafe links', () => {
    for (const publicUrl of ['javascript:alert(1)', 'not-a-url', 'https://user:password@example.com']) {
        assert.throws(() => emailTemplate('Summary', 'Readings', { publicUrl }), /GABBAI_PUBLIC_URL/);
        assert.throws(() => emailText('Readings', { publicUrl }), /GABBAI_PUBLIC_URL/);
    }
});

test('Message text cannot introduce template variables or optional-button markup', () => {
    const text = '{{inboxUrl}} <!-- IF_INBOX -->private<!-- END_IF_INBOX -->';
    const html = emailTemplate('{{content}}', text, { publicUrl: 'https://gabbai.example' });
    assert.match(html, /<title>\s*\{\{content\}\}\s*<\/title>/);
    assert.match(html, /\{\{inboxUrl\}\} &lt;!-- IF_INBOX --&gt;private&lt;!-- END_IF_INBOX --&gt;/);
});
