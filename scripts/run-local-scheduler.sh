#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ ! -f "$project_dir/.env" ]; then
  echo "Missing $project_dir/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$project_dir/.env"
set +a

: "${SCHEDULER_SECRET:?SCHEDULER_SECRET is required}"
radar_api_url=${EXPO_PUBLIC_API_URL:-http://localhost:${PORT:-3000}}

/usr/bin/curl --fail-with-body --silent --show-error \
  --connect-timeout 5 \
  --max-time 120 \
  --request POST \
  --header "Authorization: Bearer $SCHEDULER_SECRET" \
  "${radar_api_url%/}/internal/scheduler/run-due"
