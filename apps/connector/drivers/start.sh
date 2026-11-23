#!/bin/sh
set -eu
set -f
for package in ${ISPCONTROL_OLT_DRIVERS:-}; do
  case "$package" in
    *@*) ispcontrol-driver "${package%@*}" "${package##*@}" ||
      echo "No se pudo activar $package; se conserva la instalación anterior." >&2 ;;
    *) echo "Asignación de driver inválida: $package" >&2 ;;
  esac
done
exec node dist/main.js
