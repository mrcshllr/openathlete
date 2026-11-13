#!/bin/sh
# Sichert die Datenbank nach backups/ und behält die letzten 14 Sicherungen.
# Läuft vor jedem Update; als eigene Aufgabe im Aufgabenplaner: täglich.
set -eu
. "$(dirname "$0")/common.sh"

KEEP=${KEEP:-14}
mkdir -p backups
compose ps --status running --services 2>/dev/null | grep -qx postgres \
  || die "die Datenbank läuft nicht: nichts zu sichern"

file="backups/openathlete-$(date +%Y-%m-%d_%H%M).dump"
compose exec -T postgres pg_dump -U openathlete -Fc openathlete > "$file.part" \
  || { rm -f "$file.part"; die "pg_dump ist fehlgeschlagen"; }
mv "$file.part" "$file"
cp .env backups/env.backup
chmod 600 "$file" backups/env.backup
say "gesichert: $file ($(du -h "$file" | cut -f1))"

# Older dumps go, the newest KEEP stay
ls -1t backups/openathlete-*.dump | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -f "$old" && say "entfernt: $old"
done
