// One Worker does two jobs: serves the built site (static assets) and acts as the
// GitHub OAuth proxy that Decap/Sveltia CMS needs for editor login.
const GH = 'https://github.com/login/oauth';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/auth') return auth(url, env);
    if (url.pathname === '/callback') return callback(request, url, env);
    return env.ASSETS.fetch(request);
  },
};

function auth(url, env) {
  const state = crypto.randomUUID();
  const dest = new URL(`${GH}/authorize`);
  dest.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: 'repo,user',
    state,
    redirect_uri: `${url.origin}/callback`,
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: dest.toString(),
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}

async function callback(request, url, env) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = (request.headers.get('Cookie') || '').match(/oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookie) return new Response('Invalid login state. Please try again.', { status: 400 });

  const res = await fetch(`${GH}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  const data = await res.json();
  const msg = data.access_token
    ? 'authorization:github:success:' + JSON.stringify({ token: data.access_token, provider: 'github' })
    : 'authorization:github:error:' + JSON.stringify({ message: data.error_description || 'Login failed' });

  const page = `<!doctype html><meta charset="utf-8"><p>Signing you in…</p><script>
(function () {
  var msg = ${JSON.stringify(msg).replace(/</g, '\\u003c')};
  function receive(e) { window.opener.postMessage(msg, e.origin); window.removeEventListener('message', receive); window.close(); }
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>`;
  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'oauth_state=; Max-Age=0; Path=/' },
  });
}
