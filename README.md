# Clodia PWA

Mobile-first PWA companion for Clodia.

Current screen:

- Topics list
- Collapsible topic cards
- TLDR and open TODO previews rendered from Markdown
- Contact agent with profile picture

> ### 📍 This is not the entry-point repo
>
> This repository is a **component** of Clodia Platform, not a standalone
> installable product. The entry-point repo — install, quickstart, overall
> architecture, licensing and **risk warnings** — is:
>
> ### 👉 **[r-clodia/clodia-platform](https://github.com/r-clodia/clodia-platform)**
>
> Do not start here to deploy: `clodia-platform` clones the component repos,
> builds the images and orchestrates the stack. Before installing, read the
> as-is disclaimer and the **known defects** in the platform tracker —
> [open `security` issues](https://github.com/r-clodia/clodia-platform/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity)
> and [`SECURITY.md`](https://github.com/r-clodia/clodia-platform/blob/main/SECURITY.md).
> The software is distributed **AS-IS, without warranty of any kind**: you run
> it at your own risk.

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

## Licenza

Copyright (C) 2026 Davide Carboni.

GNU AGPL v3 — con opzione di licenza commerciale: vedi [LICENSING.md](LICENSING.md).
Le versioni fino al tag `apache2-final` restano Apache 2.0.
