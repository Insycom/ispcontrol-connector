# IspControl

Plataforma multi-tenant para administrar clientes de un ISP, controlar velocidad,
suspender o reactivar servicios y operar servidores de acceso como MikroTik.

## Alcance inicial

- Organizaciones completamente aisladas.
- Usuarios pertenecientes a una organización.
- Roles y permisos configurables por organización.
- Servidores asignados a cada organización.
- Abonados, planes y servicios de Internet.
- Solicitudes auditables de cambio de velocidad, corte y reconexión.

## Arquitectura propuesta

```text
apps/web       Panel administrativo (Next.js)
apps/api       API y autenticación (NestJS)
apps/connector Agente Docker instalado en la red del ISP
packages/db    Modelo PostgreSQL y cliente Prisma
packages/core  Tipos, reglas de negocio y contratos de proveedores
docs           Decisiones y documentación funcional
```

La API nunca debería conectarse directamente a un router. Registra una operación
y el connector la ejecuta de forma asíncrona. Esto permite reintentos, trazabilidad y
evita que una caída de MikroTik bloquee el panel.
