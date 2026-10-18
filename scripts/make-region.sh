#!/usr/bin/env bash
# Cut an offline region (PMTiles) from the Protomaps daily planet build (OpenStreetMap data, ODbL) with
# `pmtiles extract` (HTTP range reads — only the region's tiles are downloaded).
#   scripts/make-region.sh <region-id> [maxzoom]      e.g. scripts/make-region.sh visakhapatnam 15
#   scripts/make-region.sh all                        every region in web/offline/catalog.json
# Output: data/regions/<id>.pmtiles (served by the Bharat Map server at /regions/<id>.pmtiles; REGIONS_DIR to change).
# Needs the go-pmtiles CLI (https://github.com/protomaps/go-pmtiles/releases) on PATH or PMTILES=/path/to/pmtiles.
# Large files are NOT committed to git (data/ is ignored) and never bundled into the APK.
set -euo pipefail
cd "$(dirname "$0")/.."
PMTILES="${PMTILES:-pmtiles}"
OUT="${REGIONS_DIR:-data/regions}"
mkdir -p "$OUT"
command -v "$PMTILES" >/dev/null || { echo "pmtiles CLI not found (set PMTILES=...)"; exit 1; }

# Latest available daily build (today or up to 7 days back), unless PROTOMAPS_BUILD is given.
if [ -z "${PROTOMAPS_BUILD:-}" ]; then
  for i in 0 1 2 3 4 5 6 7; do
    d=$(date -u -d "-$i day" +%Y%m%d)
    if curl -sfI "https://build.protomaps.com/$d.pmtiles" >/dev/null; then PROTOMAPS_BUILD="https://build.protomaps.com/$d.pmtiles"; break; fi
  done
fi
[ -n "${PROTOMAPS_BUILD:-}" ] || { echo "no Protomaps build found"; exit 1; }
echo "source: $PROTOMAPS_BUILD"

ids="$1"
if [ "$ids" = "all" ]; then ids=$(node -e "console.log(require('./web/offline/catalog.json').regions.map(r=>r.id).join(' '))"); fi
for id in $ids; do
  read -r bbox mz < <(node -e "const r=require('./web/offline/catalog.json').regions.find(x=>x.id==='$id'); if(!r){console.error('unknown region $id');process.exit(1)} console.log(r.bbox.join(','), process.argv[1]||r.maxzoom)" "${2:-}")
  echo "extract $id bbox=$bbox maxzoom=$mz"
  "$PMTILES" extract "$PROTOMAPS_BUILD" "$OUT/$id.pmtiles" --bbox="$bbox" --maxzoom="$mz" --download-threads=4
  ls -la "$OUT/$id.pmtiles"
done
