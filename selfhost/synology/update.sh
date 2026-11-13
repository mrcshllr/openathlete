#!/bin/sh
# Holt die neueste Version aus meinem Fork und startet OpenAthlete neu:
#   1. Backup der Datenbank (läuft sie noch nicht: Erststart, kein Backup)
#   2. docker-compose.yml aus meinem Fork, mit meinen Images
#   3. Images holen, Container neu starten, alte Images aufräumen
# Im Aufgabenplaner als root, z. B. jede Nacht um 04:00 (nach dem Build).
set -eu
. "$(dirname "$0")/common.sh"
exec >> update.log 2>&1
say "=== Update"

mkdir .update.lock 2>/dev/null || die "ein anderes Update läuft gerade (sonst .update.lock löschen)"
trap 'rmdir .update.lock' EXIT

[ -f .env ] || die ".env fehlt: zuerst install.sh"
[ -n "$(env_value HASH_PEPPER)" ] || die "HASH_PEPPER in .env ist leer"
owner=$(env_value IMAGE_OWNER)
owner=${owner:-mrcshllr}

# 1. Backup, wenn schon etwas läuft
if compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  ./backup.sh || die "Backup fehlgeschlagen: kein Update"
fi

# 2. Compose-Datei aus meinem Fork (Branch selfhost, aus dem auch die Images
# gebaut sind), mit dessen Images statt denen des Hauptprojekts
curl -fsSL "https://raw.githubusercontent.com/$owner/openathlete/selfhost/docker-compose.yml" \
  | sed "s#ghcr.io/openathleteorg/#ghcr.io/$owner/#g" > docker-compose.yml.new \
  || die "docker-compose.yml nicht ladbar"
compose -f docker-compose.yml.new config -q || die "neue docker-compose.yml ist ungültig"
[ -f docker-compose.yml ] && cp docker-compose.yml docker-compose.yml.previous
mv docker-compose.yml.new docker-compose.yml

# 3. Images holen und neu starten (Migrationen laufen beim Start der API)
compose pull --quiet
compose up -d --remove-orphans
docker image prune -f > /dev/null
compose ps
say "=== fertig"
