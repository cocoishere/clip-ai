// Serialized by chrome.scripting: deliberately self-contained, with no imports.
export function extractPage() {
    const visible = (el: HTMLElement) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0 && !el.closest('input,textarea,[contenteditable="true"],nav,header,footer,aside'); };
    const selected = window.getSelection()?.toString().trim() || '';
    const candidates = ['#detail-desc', '.note-content', 'article', 'main', '[role="main"]'];
    let body = '';
    for (const selector of candidates) {
        const el = [...document.querySelectorAll<HTMLElement>(selector)].find(visible);
        if (el) {
            body = el.innerText.trim();
            if (body.length > 40)
                break;
        }
    }
    if (!body)
        body = [...document.querySelectorAll<HTMLElement>('h1,h2,p')].filter(visible).map(x => x.innerText).join('\n');
    const titleEl = document.querySelector<HTMLElement>('#detail-title,h1');
    return { title: titleEl && visible(titleEl) ? titleEl.innerText : document.title, url: location.href, platform: location.hostname, text: (selected || body).slice(0, 18000), capturedAt: new Date().toISOString(), tags: [...new Set((body.match(/#[\p{L}\p{N}_]+/gu) || []))].slice(0, 20), likes: null, favorites: null, comments: null };
}
