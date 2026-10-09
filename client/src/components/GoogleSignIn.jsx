import { useEffect, useRef, useState } from 'react';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let googleScriptPromise;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentityServices = 'true';
      script.onload = resolve;
      script.onerror = () => {
        googleScriptPromise = null;
        reject(new Error('Google sign-in could not load. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleSignIn({ onCredential, busy = false }) {
  const buttonHost = useRef(null);
  const callbackRef = useRef(onCredential);
  const [loadError, setLoadError] = useState('');
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId || !buttonHost.current) return undefined;
    let cancelled = false;
    loadGoogleIdentityServices().then(() => {
      if (cancelled || !buttonHost.current) return;
      const host = buttonHost.current;
      host.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) callbackRef.current?.(response.credential);
        },
        auto_select: false,
      });
      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(400, Math.floor(host.getBoundingClientRect().width)),
      });
      setLoadError('');
    }).catch((error) => {
      if (!cancelled) setLoadError(error.message);
    });
    return () => {
      cancelled = true;
      buttonHost.current?.replaceChildren();
    };
  }, []);

  if (!clientId) {
    return <div className="google-signin-unconfigured" role="status">Google sign-in needs a Google OAuth Web client ID.</div>;
  }

  return <div className={`google-signin${busy ? ' google-signin-busy' : ''}`} aria-busy={busy}>
    <div className="google-signin-button" ref={buttonHost} />
    {loadError && <p className="google-signin-error" role="alert">{loadError}</p>}
  </div>;
}
