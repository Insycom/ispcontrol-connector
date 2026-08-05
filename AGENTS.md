# IspControl development rules

IspControl is a TypeScript monorepo for a multitenant ISP OSS/BSS:

- `apps/api`: NestJS API and central source of truth.
- `apps/web`: independent Next.js frontend; it only uses the HTTP API.
- `apps/connector`: independently deployed outbound-only network agent.
- `packages/db`: Prisma/PostgreSQL central schema.
- `packages/core`: transport-independent contracts.

Never trust a `tenantId` supplied by a connector. Resolve scope from its
authenticated identity. Every user query must be tenant-filtered unless guarded
as superadmin. Never log passwords, API keys, enrollment tokens, refresh tokens,
private keys or MikroTik credentials.

Connector work is typed and versioned. Do not add shell, Docker or RouterOS raw
command endpoints. WSS may notify; jobs remain persistent and are claimed over
HTTPS. Preserve idempotency, leases, schema versions and UTC timestamps.

Use Prisma migrations for schema changes. Do not use destructive resets. Keep
the legacy connector channel compatible until its deprecation is documented.

Required checks:

```bash
npm test --workspace @ispcontrol/api
npm test --workspace @ispcontrol/connector
npm run build --workspace @ispcontrol/web
```

Update the relevant OpenAPI and documents whenever changing endpoints, jobs,
events, security or deployment.
