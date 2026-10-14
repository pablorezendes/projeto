#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
cd "$ROOT_DIR"

if [[ ! -f public/index.html ]]; then
  printf 'Falta public/index.html; nenhuma implantação foi realizada.\n' >&2
  exit 1
fi
command -v docker >/dev/null || { printf 'Docker não encontrado.\n' >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
command -v python3 >/dev/null || { printf 'Python 3 não encontrado; instale-o para detectar a configuração Traefik.\n' >&2; exit 1; }
python3 "$ROOT_DIR/scripts/configure-traefik.py" --output "$ENV_FILE"

# A fixed project name scopes all operations to this presentation only.
COMPOSE=(docker compose --project-name projeto-apice --env-file "$ENV_FILE" --file "$ROOT_DIR/compose.yaml")
"${COMPOSE[@]}" config --quiet

PREVIOUS_CONTAINER="$("${COMPOSE[@]}" ps --all --quiet web)"
PREVIOUS_IMAGE=''
if [[ -n "$PREVIOUS_CONTAINER" ]]; then
  PREVIOUS_IMAGE="$(docker inspect --format '{{.Image}}' "$PREVIOUS_CONTAINER")"
fi

RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-$$"
export APICE_IMAGE="apice-investidores:release-$RELEASE"
printf 'Construindo %s...\n' "$APICE_IMAGE"
"${COMPOSE[@]}" build --pull web
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m,uid=101,gid=101 \
  --cap-drop ALL --security-opt no-new-privileges:true "$APICE_IMAGE" -t

if "${COMPOSE[@]}" up --detach --no-deps --no-build --wait --wait-timeout 90 web; then
  printf '\nApresentação implantada. Verifique https://projeto.tescod.com\n'
  "${COMPOSE[@]}" ps web
  exit 0
fi

printf '\nA nova versão falhou na verificação de saúde.\n' >&2
"${COMPOSE[@]}" logs --tail 30 web >&2 || true
if [[ -n "$PREVIOUS_IMAGE" ]]; then
  export APICE_IMAGE="apice-investidores:rollback-$RELEASE"
  docker image tag "$PREVIOUS_IMAGE" "$APICE_IMAGE"
  if "${COMPOSE[@]}" up --detach --no-deps --no-build --wait --wait-timeout 90 web; then
    printf 'A imagem anterior foi restaurada.\n' >&2
  else
    printf 'A restauração precisa de atenção. Execute docker compose logs web.\n' >&2
  fi
else
  "${COMPOSE[@]}" stop web || true
  printf 'Primeira implantação interrompida; nenhum outro stack foi alterado.\n' >&2
fi
exit 1
