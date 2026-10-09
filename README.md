# miniapp-template

> **GitHub template** for creating a new **miniapp** — a **Re.Pack federated remote** consumed on demand by the React Native host. The [Backstage](https://github.com/DentVega/backstage-web) scaffolder generates a fresh repo from this template; the miniapp's CI builds the federated chunk for **android and iOS** and publishes both to the registry.

**🌐 Español:** [README.es.md](./README.es.md) · **Platform demo:** [backstage-web-blond.vercel.app](https://backstage-web-blond.vercel.app)

---

## Where it fits

```mermaid
flowchart LR
    T[miniapp-template<br/>this repo] -->|scaffolder clones| NEW[new miniapp repo]
    NEW -->|CI builds chunk| CDN[(CDN)]
    NEW -->|publishes version| BS[Backstage registry]
    BS -->|resolve| HOST[RN Host]
    HOST -->|mounts| CDN
```

Each miniapp is **its own repo** (own CI, own release cadence). This template is the starting point: it exposes `./Entry` so the host can mount it via Module Federation.

## What's inside

```
manifest.json           Manifest (id, version, entry, shared deps, capabilities)
rspack.config.mjs       Re.Pack / Module Federation config (exposes ./Entry)
src/Entry.tsx           Federation entry — receives scoped capabilities, guards access
src/Screen.tsx          The miniapp feature UI
scripts/                Build + publish helpers
.github/workflows/      CI: build the federated chunk for android + iOS (iOS best-effort), publish both to Backstage
```

## Create a miniapp from it

Use the **Backstage "Create miniapp"** flow (recommended — it also registers the miniapp in the catalog), or **Use this template** on GitHub. Placeholders like `__MINIAPP_ID__` are filled in per miniapp.

## Develop

```bash
pnpm install
pnpm start        # remote dev server on :9000
```

- Edit `src/Screen.tsx` (your feature) and `src/Entry.tsx` (required capability).
- Keep `manifest.json` in sync (id, version, shared deps, capabilities).
- The dev server serves the chunk at `http://localhost:9000/<id>.container.js.bundle`; the CI pipeline builds android + iOS bundles and publishes both URLs to Backstage so the host can resolve them (iOS is best-effort — a failed iOS build doesn't block the android publish).
- Need a static build for one platform instead of the dev server? `pnpm bundle:android` (→ `build/__MINIAPP_ID__.container.js.bundle`) or `pnpm bundle:ios` (→ `build/ios/__MINIAPP_ID__.container.js.bundle`).

## Contract & security

`Entry` receives `MiniappEntryProps` from `@dentvega/miniapp-contract`: **scoped capabilities, never raw credentials**. If the required permission is missing → an "unauthorized access" screen.

Every published chunk carries a **sha256 integrity** hash (Backstage computes it server-side; the host verifies it before mounting). On top of that, **chunk signing** (Ed25519 authenticity) is wired in: `scripts/publish.mjs` signs the chunk and sends a `signature` field **when the per-repo secret `MINIAPP_SIGN_KEY` is set** (without it, it publishes unsigned — safe). The host verifies the signature against a root-signed trust bundle.

## Requirements

Node 20+, pnpm or npm. `@dentvega/miniapp-contract` and `@dentvega/ui-kit` install from the **public npm registry** — no token or registry config needed.

## Related repos

| Repo | Role |
|---|---|
| [backstage-web](https://github.com/DentVega/backstage-web) | Web control plane that scaffolds + distributes miniapps *(live demo)* |
| [backstagereactnative](https://github.com/DentVega/backstagereactnative) | React Native + Re.Pack host that mounts miniapps |
| [miniapp-account-dashboard](https://github.com/DentVega/miniapp-account-dashboard) | A real miniapp built on this pattern |

---

<sub>Part of a portfolio/demo showcasing Module Federation micro-frontends for React Native.</sub>
