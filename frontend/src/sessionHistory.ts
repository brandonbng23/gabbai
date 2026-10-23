/** Revalidate sessions when a browser restores a page from its history cache. */
export function installSessionHistoryGuard(target: Window, root: HTMLElement | null): () => void {
    const originalVisibility = root?.style.visibility ?? '';
    let reloading = false;

    function hideSnapshot(event: PageTransitionEvent): void {
        if (event.persisted && root) root.style.visibility = 'hidden';
    }

    function revalidate(event: PageTransitionEvent): void {
        if (!event.persisted) return;
        reloadForSessionCheck();
    }

    function reloadForSessionCheck(): void {
        if (reloading) return;
        reloading = true;
        if (root) root.style.visibility = 'hidden';
        target.location.reload();
    }

    target.addEventListener('pagehide', hideSnapshot);
    target.addEventListener('pageshow', revalidate);
    target.addEventListener('popstate', reloadForSessionCheck);
    return () => {
        target.removeEventListener('pagehide', hideSnapshot);
        target.removeEventListener('pageshow', revalidate);
        target.removeEventListener('popstate', reloadForSessionCheck);
        if (root) root.style.visibility = originalVisibility;
    };
}
