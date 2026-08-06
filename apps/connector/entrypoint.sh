#!/bin/sh
set -eu

mkdir -p /var/lib/ispcontrol
chown -R ispcontrol:ispcontrol /var/lib/ispcontrol || true

if [ "${ISPCONTROL_RUN_AS_ROOT:-false}" = "true" ]; then
  exec "$@"
fi

if [ -S /var/run/docker.sock ] && ! su-exec ispcontrol test -r /var/run/docker.sock; then
  printf '%s\n' "The connector user cannot read /var/run/docker.sock. Configure DOCKER_GID with the host socket group." >&2
  exit 1
fi

if [ -d "${ISPCONTROL_MODULES_ROOT:-}" ] && ! su-exec ispcontrol test -w "${ISPCONTROL_MODULES_ROOT}"; then
  printf '%s\n' "The connector user cannot write to ${ISPCONTROL_MODULES_ROOT}. Check the host directory permissions." >&2
  exit 1
fi

exec su-exec ispcontrol "$@"
