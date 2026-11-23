#!/bin/sh
set -eu
exec "${ISPCONTROL_DATA_DIR:-/var/lib/ispcontrol}/drivers/cdata-fd1604sb1/current" "$@"
