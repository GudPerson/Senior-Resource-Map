import {
    getPreferredWhatsAppLaunchUrl,
    isLikelyMobileDevice,
} from './phoneVerificationState.js';

function escapePreparedWindowText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function prepareWhatsAppLaunchWindow(
    message = 'Opening WhatsApp...',
    body = 'Please wait while CareAround prepares your WhatsApp code.',
) {
    if (typeof window === 'undefined') return null;

    try {
        const preparedWindow = window.open('', '_blank');
        if (!preparedWindow) return null;

        const safeMessage = escapePreparedWindowText(message);
        const safeBody = escapePreparedWindowText(body);
        preparedWindow.document.open();
        preparedWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeMessage}</title>
    <style>
      body {
        align-items: center;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
        min-height: 100dvh;
        -webkit-text-size-adjust: 100%;
      }
      main {
        max-width: 28rem;
        padding: 2rem;
        text-align: center;
      }
      .spinner {
        animation: spin 0.9s linear infinite;
        border: 4px solid #ccfbf1;
        border-top-color: #0f9f96;
        border-radius: 999px;
        height: 3rem;
        margin: 0 auto 1rem;
        width: 3rem;
      }
      h1 {
        font-size: 1.25rem;
        margin: 0;
      }
      p {
        color: #64748b;
        line-height: 1.6;
        margin: 0.75rem 0 0;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @media (pointer: coarse) {
        body {
          align-items: flex-start;
          padding-top: 16vh;
        }
        main {
          box-sizing: border-box;
          max-width: none;
          width: 100%;
        }
        .spinner {
          border-width: 6px;
          height: clamp(4.5rem, 14vw, 8rem);
          margin-bottom: 1.25rem;
          width: clamp(4.5rem, 14vw, 8rem);
        }
        h1 {
          font-size: clamp(2rem, 7vw, 4rem);
        }
        p {
          font-size: clamp(1.25rem, 4vw, 2.25rem);
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spinner" aria-hidden="true"></div>
      <h1>${safeMessage}</h1>
      <p>${safeBody}</p>
    </main>
  </body>
</html>`);
        preparedWindow.document.close();
        return preparedWindow;
    } catch {
        return null;
    }
}

function writeWhatsAppRedirectWindow(preparedWindow, launchUrl, labels = {}) {
    const safeLaunchUrl = escapePreparedWindowText(launchUrl);
    const scriptLaunchUrl = JSON.stringify(launchUrl).replace(/</g, '\\u003c');
    const title = escapePreparedWindowText(labels.title || 'Opening WhatsApp...');
    const body = escapePreparedWindowText(labels.body || 'If WhatsApp does not open automatically, tap the button below.');
    const action = escapePreparedWindowText(labels.action || 'Open WhatsApp');

    preparedWindow.document.open();
    preparedWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${safeLaunchUrl}" />
    <title>${title}</title>
    <style>
      body {
        align-items: center;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
        min-height: 100dvh;
        -webkit-text-size-adjust: 100%;
      }
      main {
        box-sizing: border-box;
        max-width: 28rem;
        padding: 2rem;
        text-align: center;
      }
      .spinner {
        animation: spin 0.9s linear infinite;
        border: 4px solid #ccfbf1;
        border-top-color: #0f9f96;
        border-radius: 999px;
        height: 3rem;
        margin: 0 auto 1rem;
        width: 3rem;
      }
      h1 {
        font-size: 1.25rem;
        margin: 0;
      }
      p {
        color: #64748b;
        line-height: 1.6;
        margin: 0.75rem 0 0;
      }
      a {
        align-items: center;
        background: #0f9f96;
        border-radius: 999px;
        color: white;
        display: inline-flex;
        font-weight: 700;
        justify-content: center;
        margin-top: 1.25rem;
        min-height: 3rem;
        padding: 0 1.5rem;
        text-decoration: none;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @media (pointer: coarse) {
        body {
          align-items: flex-start;
          padding-top: 16vh;
        }
        main {
          max-width: none;
          width: 100%;
        }
        .spinner {
          border-width: 6px;
          height: clamp(4.5rem, 14vw, 8rem);
          margin-bottom: 1.25rem;
          width: clamp(4.5rem, 14vw, 8rem);
        }
        h1 {
          font-size: clamp(2rem, 7vw, 4rem);
        }
        p {
          font-size: clamp(1.25rem, 4vw, 2.25rem);
        }
        a {
          font-size: clamp(1.25rem, 4vw, 2rem);
          min-height: 4rem;
          padding: 0 2rem;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spinner" aria-hidden="true"></div>
      <h1>${title}</h1>
      <p>${body}</p>
      <a href="${safeLaunchUrl}" id="open-whatsapp">${action}</a>
    </main>
    <script>
      const launchUrl = ${scriptLaunchUrl};
      const openWhatsApp = () => {
        window.location.href = launchUrl;
      };
      setTimeout(openWhatsApp, 0);
      setTimeout(openWhatsApp, 400);
      document.getElementById('open-whatsapp')?.addEventListener('click', openWhatsApp);
    </script>
  </body>
</html>`);
    preparedWindow.document.close();
}

export function launchPreparedWhatsAppWindow(preparedWindow, whatsappUrl, labels = {}) {
    const launchUrl = getPreferredWhatsAppLaunchUrl(whatsappUrl, {
        preferNative: typeof navigator !== 'undefined' && isLikelyMobileDevice(navigator),
    });
    if (!launchUrl) {
        try {
            preparedWindow?.close?.();
        } catch {
            // Ignore window cleanup failures.
        }
        return false;
    }

    try {
        if (preparedWindow && !preparedWindow.closed) {
            writeWhatsAppRedirectWindow(preparedWindow, launchUrl, labels);
            return true;
        }
    } catch {
        // Fall through to a direct open attempt.
    }

    try {
        return Boolean(window.open(launchUrl, '_blank', 'noopener,noreferrer'));
    } catch {
        return false;
    }
}
