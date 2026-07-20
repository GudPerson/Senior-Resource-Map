(function installCareAroundShellRecovery() {
    const RECOVERY_DELAY_MS = 6000;
    const RETRY_TIMEOUT_MS = 10000;
    const ROOT_ID = 'root';

    function hasRenderedApp(root) {
        return Boolean(root && (root.childElementCount > 0 || root.textContent.trim()));
    }

    function getClientEntryUrl() {
        const entryScript = document.querySelector('script[type="module"][src]');
        if (!entryScript) return null;

        const entryUrl = new URL(entryScript.src, window.location.href);
        if (entryUrl.origin !== window.location.origin) return null;
        if (!entryUrl.pathname.startsWith('/assets/index-')) return null;
        return entryUrl;
    }

    function applyStyles(element, styles) {
        Object.assign(element.style, styles);
    }

    function renderRecovery(root) {
        if (!root || hasRenderedApp(root)) return;

        const page = document.createElement('main');
        page.setAttribute('role', 'alert');
        page.setAttribute('aria-live', 'polite');
        applyStyles(page, {
            alignItems: 'center',
            background: '#f8fafc',
            boxSizing: 'border-box',
            display: 'flex',
            fontFamily: 'Public Sans, Arial, sans-serif',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
        });

        const card = document.createElement('section');
        applyStyles(card, {
            background: '#ffffff',
            border: '1px solid #dbe5e8',
            borderRadius: '20px',
            boxShadow: '0 12px 30px rgba(15, 35, 45, 0.08)',
            maxWidth: '520px',
            padding: '28px',
            width: '100%',
        });

        const eyebrow = document.createElement('p');
        eyebrow.textContent = 'CareAround SG';
        applyStyles(eyebrow, {
            color: '#0b7f78',
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            margin: '0 0 10px',
            textTransform: 'uppercase',
        });

        const title = document.createElement('h1');
        title.textContent = 'The app needs a quick refresh';
        applyStyles(title, {
            color: '#18323b',
            fontSize: '26px',
            lineHeight: '1.25',
            margin: '0',
        });

        const message = document.createElement('p');
        message.textContent = 'CareAround SG did not finish loading. Your information is safe. Load the latest app to try again.';
        applyStyles(message, {
            color: '#526872',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '14px 0 0',
        });

        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.textContent = 'Load latest app';
        applyStyles(retryButton, {
            background: '#0b8f86',
            border: '0',
            borderRadius: '12px',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '700',
            marginTop: '22px',
            minHeight: '46px',
            padding: '11px 18px',
        });

        const status = document.createElement('p');
        applyStyles(status, {
            color: '#687c84',
            fontSize: '13px',
            lineHeight: '1.5',
            margin: '14px 0 0',
            minHeight: '20px',
        });

        retryButton.addEventListener('click', function retryLatestClient() {
            const entryUrl = getClientEntryUrl();
            if (!entryUrl) {
                status.textContent = 'Please close this tab and open CareAround SG again.';
                return;
            }

            retryButton.disabled = true;
            retryButton.style.cursor = 'wait';
            retryButton.style.opacity = '0.72';
            status.textContent = 'Loading the latest app...';

            entryUrl.searchParams.set('carearound-retry', String(Date.now()));
            const retryScript = document.createElement('script');
            retryScript.type = 'module';
            retryScript.src = entryUrl.href;
            retryScript.addEventListener('error', function showRetryError() {
                retryButton.disabled = false;
                retryButton.style.cursor = 'pointer';
                retryButton.style.opacity = '1';
                status.textContent = 'The app still could not load. Check your connection, then try again.';
            }, { once: true });
            document.head.appendChild(retryScript);

            window.setTimeout(function checkRetryResult() {
                if (!document.body.contains(page)) return;
                retryButton.disabled = false;
                retryButton.style.cursor = 'pointer';
                retryButton.style.opacity = '1';
                status.textContent = 'The app still could not load. Check your connection, then try again.';
            }, RETRY_TIMEOUT_MS);
        });

        card.append(eyebrow, title, message, retryButton, status);
        page.appendChild(card);
        root.replaceChildren(page);
    }

    window.setTimeout(function checkCareAroundShell() {
        const root = document.getElementById(ROOT_ID);
        if (!hasRenderedApp(root)) renderRecovery(root);
    }, RECOVERY_DELAY_MS);
}());
