# API-managed CA trust for Connector destinations

Status: proposed

## Problem

Connectors must reach devices such as MikroTik over TLS when the device
certificate is issued by a private or self-managed CA. Installing that CA by
editing the Connector host or container couples device onboarding and
certificate rotation to deployment changes.

The first concrete case is `networkaj.sys.ar:8729`, which exposes MikroTik API
SSL with a certificate issued by a private CA. The Connector must be able to
trust the public CA delivered by ISP Control while preserving normal chain and
hostname validation.

## Connector scope

- Fetch the versioned effective CA bundle from the central API using the
  Connector's existing machine identity.
- Validate the response schema, certificate parsing, CA capability, validity,
  supported algorithms, bundle version, and deterministic digest before use.
- Keep the last-known-good bundle in Connector-managed data storage with
  restrictive permissions and atomic replacement. Never require an operator to
  edit the image, Compose file, or system trust store.
- Apply additional trust only to the explicitly assigned destination
  hostname/IP and port. Do not mutate Node.js global trust and do not create a
  process-wide TLS bypass.
- Continue to enforce hostname/IP verification after certificate-chain
  validation.
- Support overlapping CAs during rotation and remove revoked assignments after
  a successful bundle refresh.
- Report the active bundle version/digest and refresh outcome through the
  existing event/heartbeat channel without logging PEM bodies.
- Preserve the last-known-good bundle when refresh or validation fails, emit an
  actionable error, and retry with bounded backoff.
- Keep the legacy Connector channel compatible until its deprecation is
  documented.

## Runtime behavior

1. Authenticate to the API and obtain the effective trust-bundle metadata.
2. Skip download when the digest matches the active bundle.
3. Download and fully validate a changed bundle.
4. Write it atomically to Connector-managed storage.
5. Build a destination-scoped TLS context for the assigned device.
6. Connect with certificate-chain and hostname validation enabled.
7. Report success or a sanitized failure and retain the last-known-good bundle.

No raw shell, Docker-control, RouterOS-command, or remote-file-write endpoint is
part of this feature.

## Security requirements

- Never accept or persist private keys in a CA bundle.
- Never use `NODE_TLS_REJECT_UNAUTHORIZED=0`, an insecure HTTPS agent, or an
  equivalent global override.
- Trust anchors may be platform-wide (such as the Insycom CA) or tenant-owned,
  but their use remains explicitly device/Connector/destination scoped and
  cannot authorize an unrelated destination.
- Bundle files and logs must not include device credentials, enrollment tokens,
  refresh tokens, or private keys.
- A malformed, expired, revoked, weak, or digest-mismatched bundle fails closed.

## Acceptance criteria

1. The Connector validates a private-CA MikroTik API SSL endpoint after the CA
   is assigned through ISP Control, with no container or host modification.
2. The same endpoint fails when the CA is absent, revoked, expired, or does not
   match the advertised digest.
3. A valid chain with a hostname/IP mismatch is rejected.
4. Trust assigned to one device cannot validate an unrelated destination.
5. Rotation with overlapping old/new CAs succeeds without downtime, and
   revocation removes old trust after refresh.
6. Restart preserves the last-known-good bundle; corrupt local state fails
   closed and is recoverable through a fresh authenticated download.
7. Unit and integration tests cover bundle validation, atomic persistence,
   scoping, refresh failure, rotation, and sanitized reporting.
8. The versioned API/Connector contract and deployment documentation are
   updated together with the implementation.
9. One platform CA can validate explicitly assigned MikroTik certificates from
   multiple tenants without becoming a global process trust override.

## Out of scope

- Importing CAs into the operating-system trust store.
- Restarting or rebuilding Connector containers to rotate trust.
- Disabling TLS validation.
- Transporting or managing CA private keys.
