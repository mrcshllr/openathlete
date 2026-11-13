#!/bin/sh
# Spielt eine Sicherung zurück: ./restore.sh backups/openathlete-2026-11-13_0300.dump
# ERSETZT alle Daten der Instanz durch den Stand der Sicherung.
set -eu
. "$(dirname "$0")/common.sh"

dump=${1:-}
[ -f "$dump" ] || die "Aufruf: $0 backups/<datei>.dump"
[ "${2:-}" = "--ja" ] || die "ersetzt alle Daten durch $dump. Zum Bestätigen: $0 $dump --ja"

say "stoppe API und Web"
compose stop api web
compose up -d postgres
sleep 5
say "spiele $dump zurück"
compose exec -T postgres pg_restore -U openathlete -d openathlete --clean --if-exists --no-owner < "$dump"
compose up -d
say "fertig"
