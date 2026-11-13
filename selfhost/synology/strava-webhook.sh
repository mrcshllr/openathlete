#!/bin/sh
# Einmalig: meldet bei Strava an, wohin es neue Aktivitäten schickt
# (APP_URL/api/provider/strava/webhook). OpenAthlete muss dafür laufen und
# unter APP_URL öffentlich erreichbar sein: Strava prüft die Adresse sofort.
set -eu
. "$(dirname "$0")/common.sh"

id=$(env_value STRAVA_CLIENT_ID); secret=$(env_value STRAVA_CLIENT_SECRET)
token=$(env_value STRAVA_WEBHOOK_TOKEN); url=$(env_value APP_URL)
[ -n "$id" ] && [ -n "$secret" ] && [ -n "$token" ] || die "STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET und STRAVA_WEBHOOK_TOKEN in .env setzen"

case "${1:-}" in
  --show)
    curl -fsS -G https://www.strava.com/api/v3/push_subscriptions -d client_id="$id" -d client_secret="$secret"; echo ;;
  *)
    curl -sS -X POST https://www.strava.com/api/v3/push_subscriptions \
      -F client_id="$id" -F client_secret="$secret" \
      -F callback_url="$url/api/provider/strava/webhook" -F verify_token="$token"
    echo
    say "Eine Antwort mit \"id\" heißt: fertig. Prüfen: $0 --show" ;;
esac
