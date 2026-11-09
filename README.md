# Clodia PWA

> [!WARNING]
> **DEPRECATED — this app is retired.** The Clodia PWA is retired as of the
> platform release that closes
> [r-clodia/clodia-platform#657](https://github.com/r-clodia/clodia-platform/issues/657):
> the `pwa` service is no longer part of the platform's compose file, the
> WebUI no longer offers "Dispositivo PWA" pairing, and the servers refuse
> the 30-day pairing tokens this app was paired with.
>
> **Use the Clodia WebUI** (`clodia-web`) instead, on desktop and on mobile.
>
> This repository will be archived read-only and kept for history. No further
> changes, fixes or releases will be made here.

The mobile-first companion app for a Clodia colony: an installable PWA that
talks to the **agent-server** over the same API the web UI uses.

It shows the topics you take part in, the agents and their profile pictures,
the channels and direct messages, and it lets you download a topic's files.

It is deliberately a **thin** client. It reads a topic's title and its messages
and nothing else — not the participants, not the mounts, not the gates. That is
why the model work of v9 (roles as a map, mounts as a collection, portability,
what a gate crosses) required **no change here**: measured against the running
instance on 9 Aug 2026, every endpoint it calls still exists and every field it
reads is still there. A thin client is cheap to keep aligned, and that is the
point of keeping it thin.

One thing to know for later: it addresses channels under the
`/clodia/channels/…` prefix, which the platform intends to retire. When that
happens, this repository has to move with it.

> ### 📍 This is not the entry repository
>
> This repository is a **component** of Clodia Platform, not something you
> install on its own. Installation, quickstart, architecture, licence and the
> **risk warnings** live in:
>
> ### 👉 **[r-clodia/clodia-platform](https://github.com/r-clodia/clodia-platform)**
>
> Do not deploy from here: `clodia-platform` clones the component repositories,
> builds the images and orchestrates the stack. Before installing, read the
> as-is disclaimer and the **known defects** in the platform tracker —
> [open `security` issues](https://github.com/r-clodia/clodia-platform/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity)
> and [`SECURITY.md`](https://github.com/r-clodia/clodia-platform/blob/main/SECURITY.md).
> The software is distributed **AS IS, without warranty**: you run it at your
> own risk.

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

## Licence

Copyright (C) 2026 Davide Carboni.

GNU AGPL v3, with a commercial option: see [LICENSING.md](LICENSING.md).
Releases up to the `apache2-final` tag remain Apache 2.0.
