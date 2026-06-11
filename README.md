# @staklyapp/contracts

> Lingua franca Stakly v3 — Zod schemas + TypeScript types partagés entre
> `stakly-hub` (BFF tRPC) et `stakly-ui` (SPA Astro+React).

## Pourquoi ?

Avant ce package, chaque pack/repo redéfinissait ses propres types pour
`AgentSnapshot`, `DisplayPayload`, `AppDescriptor`, `ToolDescriptor`, etc.
Risque de divergence silencieuse Hub ↔ UI, dette de refacto à chaque
sprint pack.

Ce package est **la source unique de vérité** pour :

- **44C** — identifiants Stakly v3 (16 types canon)
- **Display Engine** — slots, payloads, ACL multi-héritage INTERSECTION
- **Apps** — 7 univers canon (App Launcher 9-dots)
- **Tools** — 5 outils Z3 (Toolbar transverse)
- **Agents** — `AgentSnapshot` / `AgentDelta` CQRS (Postgres + Redis)
- **Runtime** — `MSG_`, `INS_`, `EVT_`, `RSP_` éphémères + ROOM Matrix
- **Errors** — `StaklyError` discriminée

## Installation

```bash
# Hub / pack côté Node
pnpm add @staklyapp/contracts

# UI côté Astro/React (devDep typings inclus dans dist)
pnpm add @staklyapp/contracts
```

`zod ^3.23` est en `peerDependencies`.

## Usage

```ts
// Tout depuis l'index
import {
  is44C,
  parse44C,
  format44C,
  type T44C,
  AgentSnapshotSchema,
  AppDescriptorSchema,
  StaklyErrorSchema,
  CONTRACTS_VERSION,
} from "@staklyapp/contracts";

// Ou sous-module ciblé
import { DisplayPayloadSchema } from "@staklyapp/contracts/display-engine";
import { ToolDescriptorSchema } from "@staklyapp/contracts/tools";
```

## Exemple — valider une entrée tRPC côté Hub

```ts
import { AgentSnapshotSchema, type AgentSnapshot } from "@staklyapp/contracts/agents";

const snapshot: AgentSnapshot = AgentSnapshotSchema.parse(odooRow);
```

## Exemple — consommer côté UI

```tsx
import type { AppDescriptor } from "@staklyapp/contracts/apps";

export function AppLauncher({ apps }: { apps: AppDescriptor[] }) {
  return apps.map((a) => <a href={a.href}>{a.label}</a>);
}
```

## Build

```bash
pnpm install
pnpm build       # dual ESM + CJS dans dist/
pnpm test        # Vitest
pnpm typecheck   # tsc --noEmit
```

## Versioning

SemVer strict. Tout changement breaking de schema = major bump.

`CONTRACTS_VERSION` est exposé comme constante pour les checks runtime.

## Licence

UNLICENSED — usage interne Stakly v3.
