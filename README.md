# Clodia PWA

Mobile-first PWA companion for Clodia.

Current screen:

- Topics list
- Collapsible topic cards
- TLDR and open TODO previews rendered from Markdown
- Contact agent with profile picture

## Development

Run against a local agent-server:

```bash
npm run dev
```

Run against the host backend through the Vite proxy:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:7842 npm run dev -- --host 0.0.0.0
```

For a static deployment that calls an API directly:

```bash
VITE_PUBLIC_API_BASE_URL=http://127.0.0.1:7842 npm run build
```

If the PWA and backend are served from the same origin, leave
`VITE_PUBLIC_API_BASE_URL` unset.

## Production server

The repo includes a tiny dependency-free Node server for the host:

```bash
npm run build
PORT=5173 API_TARGET=http://127.0.0.1:7842 npm run start
```

It serves `build/` with SPA fallback and proxies API prefixes to the local
agent-server.
