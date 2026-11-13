#!/bin/sh
# Richtet OpenAthlete in einem Ordner auf der Synology ein:
#   curl -fsSL https://raw.githubusercontent.com/mrcshllr/openathlete/selfhost/selfhost/synology/install.sh | sh -s /volume1/docker/openathlete
# Holt die Skripte, legt .env mit neuen Geheimnissen an (eine bestehende .env
# bleibt unverändert) und startet noch nichts.
set -eu
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

DIR=${1:-/volume1/docker/openathlete}
RAW=${RAW:-https://raw.githubusercontent.com/mrcshllr/openathlete/selfhost/selfhost/synology}

mkdir -p "$DIR/backups"
cd "$DIR"
for f in common.sh update.sh backup.sh restore.sh strava-webhook.sh env.example; do
  curl -fsSL "$RAW/$f" -o "$f.new" && mv "$f.new" "$f"
done
chmod 755 update.sh backup.sh restore.sh strava-webhook.sh

if [ ! -f .env ]; then
  secret() { openssl rand -hex 32; }
  sed -e "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=$(secret)/" \
      -e "s/^HASH_PEPPER=$/HASH_PEPPER=$(secret)/" \
      -e "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" \
      -e "s/^STRAVA_WEBHOOK_TOKEN=$/STRAVA_WEBHOOK_TOKEN=$(openssl rand -hex 16)/" \
      env.example > .env
  chmod 600 .env
  echo ".env angelegt, mit neuen Geheimnissen."
else
  echo ".env gibt es schon: unverändert."
fi

echo "Fertig in $DIR. Weiter: .env prüfen und ausfüllen, dann $DIR/update.sh ausführen."
