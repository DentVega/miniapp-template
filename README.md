# @org/miniapp-__MINIAPP_ID__

Miniapp federada (**Re.Pack remote**) generada desde `miniapp-template`.
Expone `./Entry` para que el **host** la monte bajo demanda vía Module Federation.

## Requisitos
- Node 20+, pnpm o npm.
- Acceso a **GitHub Packages** para instalar `@org/miniapp-contract` y `@org/ui-kit`.
  `.npmrc` (ya incluido):
  ```
  @org:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}   # read:packages
  ```

## Desarrollo
```bash
pnpm install              # o npm install
pnpm start                # dev server del remote en :9000
```
- Edita `src/Screen.tsx` (tu feature) y `src/Entry.tsx` (capability requerida).
- Mantén `manifest.json` en sync (id, version, shared, capabilities).

## Publicar la URL a Backstage
En dev, tu dev server sirve el chunk en `http://localhost:9000/__MINIAPP_ID__.container.js.bundle`.
Registra/publica esa URL en Backstage (`POST /api/miniapps/:id/publish`) para que el host la resuelva.
> El pipeline automático (build → CDN → publish) llega en Intent 03.

## Contrato
`Entry` recibe `MiniappEntryProps` (del contrato): capabilities scoped, nunca credenciales.
Si falta el permiso requerido → pantalla "acceso no autorizado".
