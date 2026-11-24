#!/bin/sh
# Holt die neueste Version aus meinem Fork und startet OpenAthlete neu, wenn
# es eine gibt:
#   1. docker-compose.yml aus meinem Fork, mit meinen Images
#   2. Images holen. Nichts Neues: nur das tägliche Backup, sonst nichts
#   3. Backup der Datenbank (läuft sie noch nicht: Erststart, kein Backup)
#   4. API und Web neu anlegen, alte Images aufräumen
# Im Aufgabenplaner als root. Weil ein Lauf ohne Neues die Container nicht
# anfasst, darf die Aufgabe oft laufen (z. B. alle 10 Minuten): ein Build ist
# dann kurz nach dem Push auf dem NAS.
set -eu
. "$(dirname "$0")/common.sh"
exec >> update.log 2>&1

mkdir .update.lock 2>/dev/null || die "ein anderes Update läuft gerade (sonst .update.lock löschen)"
trap 'rmdir .update.lock' EXIT

[ -f .env ] || die ".env fehlt: zuerst install.sh"
[ -n "$(env_value HASH_PEPPER)" ] || die "HASH_PEPPER in .env ist leer"
owner=$(env_value IMAGE_OWNER)
owner=${owner:-mrcshllr}

# 1. Compose-Datei aus meinem Fork (Branch selfhost, aus dem auch die Images
# gebaut sind), mit dessen Images statt denen des Hauptprojekts
curl -fsSL "https://raw.githubusercontent.com/$owner/openathlete/selfhost/docker-compose.yml" \
  | sed "s#ghcr.io/openathleteorg/#ghcr.io/$owner/#g" > docker-compose.yml.new \
  || die "docker-compose.yml nicht ladbar"
compose -f docker-compose.yml.new config -q || die "neue docker-compose.yml ist ungültig"
same_compose=no
if [ -f docker-compose.yml ] && cmp -s docker-compose.yml docker-compose.yml.new; then
  same_compose=yes
  rm -f docker-compose.yml.new
else
  [ -f docker-compose.yml ] && cp docker-compose.yml docker-compose.yml.previous
  mv docker-compose.yml.new docker-compose.yml
fi

# 2. Images holen. Die IDs vorher und nachher sagen, ob etwas Neues kam
image_ids() {
  compose config --images | sort | while read -r image; do
    docker image inspect -f '{{.Id}}' "$image" 2>/dev/null || echo "fehlt:$image"
  done
}
before=$(image_ids)
compose pull --quiet
after=$(image_ids)
running=$(compose ps --status running --services 2>/dev/null | sort | tr '\n' ' ')
case "$running" in
  *api*web*) all_up=yes ;;
  *) all_up=no ;;
esac
# Sichert und merkt sich wann, für das tägliche Backup ohne Update
backup() {
  ./backup.sh || return 1
  date +%s > .last-backup
}
if [ "$before" = "$after" ] && [ "$same_compose" = yes ] && [ "$all_up" = yes ]; then
  # Nichts Neues, alles läuft: die Container bleiben, wie sie sind. Nur das
  # Backup, wenn das letzte 20 Stunden her ist (sonst kein Eintrag im Log)
  last=$(cat .last-backup 2>/dev/null || echo 0)
  if [ $(($(date +%s) - last)) -ge 72000 ]; then
    backup || die "tägliches Backup fehlgeschlagen"
  fi
  exit 0
fi
say "=== Update"

# 3. Backup, wenn schon etwas läuft
if compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  backup || die "Backup fehlgeschlagen: kein Update"
fi

# 4. API und Web entfernen und neu anlegen (Migrationen laufen beim Start der
# API). Entfernt statt im Lauf ersetzt: Compose legt den Nachfolger sonst unter
# einem Übergangsnamen an (<alte ID>_<Name>), den Container Manager behält und
# unter dem er den Container dann nicht mehr findet
compose rm -sf api web > /dev/null 2>&1 || true
compose up -d --remove-orphans
docker image prune -f > /dev/null
compose ps
say "=== fertig"
