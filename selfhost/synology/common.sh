# Shared by the scripts of this folder (sourced, not run).
# DSM's task scheduler starts scripts with a short PATH
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH
export PATH

say() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { say "FEHLER: $*" >&2; exit 1; }

DIR=$(cd "$(dirname "$0")" && pwd)
cd "$DIR" || die "kann nicht nach $DIR wechseln"

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose "$@"; }
else
  die "Docker Compose fehlt: Container Manager im Paket-Zentrum installieren"
fi

# A value of .env, without running it as a script
env_value() {
  sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1 | sed 's/^"\(.*\)"$/\1/'
}
