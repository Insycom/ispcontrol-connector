#!/bin/sh
set -eu

mkdir -p /var/lib/ispcontrol
chown -R ispcontrol:ispcontrol /var/lib/ispcontrol || true

exec su-exec ispcontrol "$@"
