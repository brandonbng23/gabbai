import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { userTitles } from '../../../interfaces/titles.mts';

function authReturnPath(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    try {
        const path = new URL(value, window.location.origin);
        if (path.origin !== window.location.origin || ['/signin', '/signup'].includes(path.pathname.replace(/\/$/, ''))) return '/';
        return path.pathname + path.search + path.hash;
    } catch { return '/'; }
}

type ShulMatch = { id: string; name: string; address: string; code: string };

function ShulCodeField() {
    const [letters, setLetters] = useState(['', '', '', '']);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const searchToggle = useRef<HTMLButtonElement>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [matches, setMatches] = useState<ShulMatch[]>([]);
    const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [selected, setSelected] = useState<ShulMatch | null>(null);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!searchOpen || query.trim().length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(`/api/shuls/search?${new URLSearchParams({ q: query.trim() })}`, { signal: controller.signal });
                if (!response.ok) throw new Error('Unable to search for shuls.');
                const results: ShulMatch[] = await response.json();
                if (!controller.signal.aborted) {
                    setMatches(results);
                    setSearchStatus('ready');
                }
            } catch {
                if (!controller.signal.aborted) setSearchStatus('error');
            }
        }, 250);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [searchOpen, query, retry]);

    function enterCode(value: string, position: number) {
        const code = value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4);
        if (!code) return;
        setSelected(null);
        const start = code.length === 4 ? 0 : position;
        const next = [...letters];
        for (let index = start; index < Math.min(start + code.length, 4); index++) next[index] = code[index - start];
        setLetters(next);
        inputs.current[Math.min(start + code.length, 3)]?.focus();
    }

    return <div className="auth-field auth-code-field" role="group" aria-labelledby="auth-code-label" aria-describedby="auth-code-hint">
        <label id="auth-code-label" htmlFor="auth-shulCode">Shul code</label>
        <div className="auth-code-slots">
            {letters.map((letter, index) => <input key={index}
                ref={input => { inputs.current[index] = input; }}
                id={index === 0 ? 'auth-shulCode' : `auth-shulCode-${index + 1}`}
                className={`auth-code-letter${letter ? ' auth-code-letter-filled' : ''}`} value={letter} type="text" inputMode="text"
                required pattern="[A-Z]" maxLength={4} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                aria-label={`Shul code, letter ${index + 1} of 4`} aria-describedby="auth-code-hint"
                onFocus={event => event.currentTarget.select()}
                onChange={event => {
                    setSelected(null);
                    if (!event.target.value) setLetters(previous => previous.map((value, at) => at === index ? '' : value));
                    else enterCode(event.target.value, index);
                }}
                onPaste={event => {
                    event.preventDefault();
                    enterCode(event.clipboardData.getData('text'), index);
                }}
                onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        inputs.current[Math.max(0, Math.min(3, index + (event.key === 'ArrowLeft' ? -1 : 1)))]?.focus();
                    } else if (event.key === 'Backspace' && !letter && index > 0) {
                        event.preventDefault();
                        setSelected(null);
                        setLetters(previous => previous.map((value, at) => at === index - 1 ? '' : value));
                        inputs.current[index - 1]?.focus();
                    }
                }} />)}
        </div>
        <input type="hidden" name="shulCode" value={letters.join('')} />
        <span id="auth-code-hint" className="auth-hint">Enter your shul’s four-letter code, or DEMO to try it out.</span>
        {selected && <span className="auth-shul-selected" role="status">Selected: {selected.name}</span>}
        <button ref={searchToggle} type="button" className="auth-shul-search-toggle" aria-expanded={searchOpen} aria-controls="auth-shul-search"
            onClick={() => setSearchOpen(open => !open)}>
            {searchOpen ? 'Close search' : 'Don’t know your code? Find your shul'}
        </button>
        {searchOpen && <div id="auth-shul-search" className="auth-shul-search" onKeyDown={event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setSearchOpen(false);
                searchToggle.current?.focus();
            }
        }}>
            <label htmlFor="auth-shul-query">Search by name or location</label>
            <input id="auth-shul-query" type="search" placeholder="Shul name or city" value={query} maxLength={100} autoComplete="off"
                onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
                onChange={event => {
                    setQuery(event.target.value);
                    setMatches([]);
                    setSearchStatus(event.target.value.trim().length >= 2 ? 'loading' : 'idle');
                }} />
            <div className="auth-shul-search-feedback" role="status">
                {searchStatus === 'idle' && <span>Enter at least two characters to search.</span>}
                {searchStatus === 'loading' && <>
                    <span className="visually-hidden">Searching for shuls…</span>
                    <div className="auth-shul-search-skeleton" aria-hidden="true"><span /><span /></div>
                </>}
                {searchStatus === 'ready' && <span>{matches.length ? `${matches.length === 20 ? 'First 20' : matches.length} matching shuls. Select yours below.` : 'No shuls found. Try another name or city.'}</span>}
                {searchStatus === 'error' && <span>Unable to search. <button type="button" className="auth-shul-search-toggle" onClick={() => {
                    setSearchStatus('loading');
                    setRetry(attempt => attempt + 1);
                }}>Try again</button></span>}
            </div>
            {matches.length > 0 && <ul className="auth-shul-results">
                {matches.map(shul => <li key={shul.id}><button type="button" onClick={() => {
                    setLetters(shul.code.split(''));
                    setSelected(shul);
                    setSearchOpen(false);
                    inputs.current[3]?.focus();
                }}><span>{shul.name}</span>{shul.address && <small>{shul.address}</small>}</button></li>)}
            </ul>}
        </div>}
    </div>;
}

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
    const signup = mode === 'signup';
    const currentPath = window.location.pathname + window.location.search;
    const next = authReturnPath(new URLSearchParams(window.location.search).get('next')
        ?? (['/signin', '/signup'].includes(window.location.pathname.replace(/\/$/, '')) ? '/' : currentPath));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [demoAvailable, setDemoAvailable] = useState(false);
    const [demoBusy, setDemoBusy] = useState(false);
    const otherUrl = `${signup ? '/signin' : '/signup'}?${new URLSearchParams({ next })}`;

    useEffect(() => {
        const controller = new AbortController();
        void fetch('/api/auth/options', { signal: controller.signal }).then(async response => {
            if (!response.ok) return;
            const options = await response.json();
            if (!controller.signal.aborted) setDemoAvailable(options.demoAvailable === true);
        }).catch(() => { /* Regular sign-in remains available if demo discovery fails. */ });
        return () => controller.abort();
    }, []);

    async function signinDemo() {
        if (busy) return;
        setBusy(true);
        setDemoBusy(true);
        setError('');
        try {
            const response = await fetch('/api/auth/demo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                throw new Error(failure?.error || 'Unable to sign in to the demo. Please try again.');
            }
            window.location.assign(next);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to sign in to the demo.');
            setBusy(false);
            setDemoBusy(false);
        }
    }

    async function submit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const value = (key: string) => String(form.get(key) ?? '');
        const password = value('password');
        setError('');
        if (signup && password !== value('confirmPassword')) { setError('Your passwords don’t match.'); return; }
        setBusy(true);
        try {
            const details = signup ? { title: value('title'), firstName: value('firstName').trim(), lastName: value('lastName').trim(),
                shulCode: value('shulCode').trim().toUpperCase() } : {};
            const response = await fetch(`/api/auth/${mode === 'signup' ? 'register' : 'signin'}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: value('email').trim(), password, ...details }),
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                throw new Error(failure?.error || 'Unable to sign in. Please try again.');
            }
            window.location.assign(next);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to sign in. Please try again.');
            setBusy(false);
        }
    }

    return <main className="auth-page">
        <a className="auth-brand" href="/">Gabbai</a>
        <section className={`auth-card${signup ? ' auth-card-signup' : ''}`} aria-labelledby="auth-heading">
            <span className="settings-eyebrow">WELCOME TO GABBAI</span>
            <h1 id="auth-heading">{signup ? 'Create your account' : 'Sign in'}</h1>
            <p>{signup ? 'Enter your shul code or search for your congregation to get started.' : 'Your shul, readings, and preferences in one place.'}</p>
            <form onSubmit={submit}>
                <fieldset disabled={busy}>
                    <legend className="visually-hidden">{signup ? 'Create account' : 'Sign in'}</legend>
                    {signup && <>
                        <ShulCodeField />
                        <div className="auth-name-fields">
                            <div className="auth-field"><label htmlFor="auth-title">Title</label>
                                <select id="auth-title" name="title" autoComplete="honorific-prefix" required defaultValue="">
                                    <option value="" disabled>Select</option>
                                    {userTitles.map(title => <option key={title} value={title}>{title}</option>)}
                                </select>
                            </div>
                            <div className="auth-field"><label htmlFor="auth-firstName">First name</label><input id="auth-firstName" name="firstName" autoComplete="given-name" required maxLength={254} /></div>
                            <div className="auth-field"><label htmlFor="auth-lastName">Last name</label><input id="auth-lastName" name="lastName" autoComplete="family-name" required maxLength={254} /></div>
                        </div>
                    </>}
                    <div className="auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" autoComplete="username" required maxLength={254} /></div>
                    <div className={signup ? 'auth-pair' : undefined}>
                        <div className="auth-field"><label htmlFor="auth-password">Password</label>
                            <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'}
                                required minLength={signup ? 12 : 1} maxLength={128} aria-describedby={signup ? 'auth-password-hint' : undefined} />
                        </div>
                        {signup && <div className="auth-field"><label htmlFor="auth-confirmPassword">Confirm password</label>
                            <input id="auth-confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} />
                        </div>}
                    </div>
                    <div className="auth-password-options">
                        {signup && <span id="auth-password-hint">Use 12–128 characters.</span>}
                        <label><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show password</label>
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className="auth-submit" type="submit">{busy ? signup ? 'Creating account…' : 'Signing in…' : signup ? 'Create account' : 'Sign in'}</button>
                    {!signup && demoAvailable && <div className="auth-demo-signin">
                        <span>Explore with the demo account</span>
                        <button type="button" className="auth-demo-button" onClick={() => { void signinDemo(); }}>
                            {demoBusy ? 'Signing in to demo…' : 'Sign in to demo'}
                        </button>
                    </div>}
                    {busy && <span className="visually-hidden" role="status">{signup ? 'Creating your account' : 'Signing in'}</span>}
                </fieldset>
            </form>
            <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Gabbai?'} <a href={otherUrl}>{signup ? 'Sign in' : 'Create an account'}</a></p>
        </section>
    </main>;
}
