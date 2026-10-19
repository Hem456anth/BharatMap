#!/usr/bin/env bash
# Build a Valhalla routing graph (tiles) for one region — groundwork for on-device offline routing (docs/OFFLINE_ROUTING.md).
# No on-device engine yet: this produces the tile set the future Android engine (or a self-hosted Valhalla) would load.
#
#   scripts/build-graph.sh                      # Visakhapatnam, OSM data from the Overpass API (bbox, roads only)
#   SOURCE=geofabrik scripts/build-graph.sh     # clip the Geofabrik India "southern zone" extract with osmium instead
#   OSM_PBF=/path/region.osm.pbf scripts/build-graph.sh   # use an extract you already have (clipped to BBOX)
#   ENGINE=docker scripts/build-graph.sh        # build with the ghcr.io/valhalla/valhalla image instead of pyvalhalla
#
# Env: REGION (default vizag), BBOX "minlon,minlat,maxlon,maxlat" (default the bundled Visakhapatnam region),
#      OUT (default osm/graph/<region>), OVERPASS (endpoint).
# Needs: osmium-tool; pyvalhalla (pip install pyvalhalla — ships valhalla_build_tiles for x86_64 and aarch64)
#        or docker. Data © OpenStreetMap contributors (ODbL).
set -euo pipefail
cd "$(dirname "$0")/.."
REGION=${REGION:-vizag}
BBOX=${BBOX:-83.15,17.62,83.42,17.85}
OUT=${OUT:-osm/graph/$REGION}
SOURCE=${SOURCE:-overpass}
ENGINE=${ENGINE:-pyvalhalla}
OVERPASS=${OVERPASS:-https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter https://maps.mail.ru/osm/tools/overpass/api/interpreter}
GEOFABRIK=${GEOFABRIK:-https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf}
mkdir -p "$OUT" osm
PBF="osm/$REGION.osm.pbf"
IFS=, read -r W S E N <<< "$BBOX"

if [ -n "${OSM_PBF:-}" ] && [ "$(realpath "$OSM_PBF")" = "$(realpath -m "$PBF")" ]; then
  echo "== using the existing clipped extract $PBF"
elif [ -n "${OSM_PBF:-}" ]; then
  echo "== clipping $OSM_PBF to $BBOX"
  osmium extract -b "$BBOX" --strategy=smart -O -o "$PBF" "$OSM_PBF"
elif [ "$SOURCE" = geofabrik ]; then
  echo "== downloading $GEOFABRIK (large) and clipping to $BBOX"
  curl -fL -o osm/source.osm.pbf "$GEOFABRIK"
  ls -l osm/source.osm.pbf
  osmium extract -b "$BBOX" --strategy=smart -O -o "$PBF" osm/source.osm.pbf
  [ -n "${KEEP_SOURCE:-}" ] || rm -f osm/source.osm.pbf
else
  echo "== Overpass: every highway (+ turn restrictions) in $BBOX"
  Q="[out:xml][timeout:600][maxsize:1073741824];(way[\"highway\"]($S,$W,$N,$E);relation[\"type\"=\"restriction\"]($S,$W,$N,$E););(._;>;);out;"
  ok=""
  for EP in $OVERPASS; do
    echo "   trying $EP"
    if curl -fsS --max-time 900 -A "BharatMap-build-graph/0.6 (github.com/Hem456anth/BharatMap)" --data-urlencode "data=$Q" -o "osm/$REGION.osm" "$EP"; then ok=1; break; fi
  done
  [ -n "$ok" ] || { echo "all Overpass endpoints failed"; exit 1; }
  osmium cat -O -o "$PBF" "osm/$REGION.osm"
  rm -f "osm/$REGION.osm"
fi
osmium fileinfo -e "$PBF" | grep -E "Number of (nodes|ways|relations)" || true
ls -l "$PBF"

CONF="$OUT/valhalla.json"
if [ "$ENGINE" = docker ]; then
  docker run --rm -v "$PWD:/work" -w /work ghcr.io/valhalla/valhalla:latest bash -c \
    "valhalla_build_config --mjolnir-tile-dir $OUT/tiles --mjolnir-tile-extract $OUT/tiles.tar --mjolnir-timezone '' --mjolnir-admin '' > $CONF && valhalla_build_tiles -c $CONF $PBF && valhalla_build_extract -c $CONF -v"
else
  # run python from /tmp: a ./valhalla directory in the repo (self-hosting data) would shadow the pyvalhalla package
  ABS=$(pwd); PY() { (cd /tmp && python3 "$@"); }
  VBIN=$(PY -c 'import valhalla, os; print(os.path.join(os.path.dirname(valhalla.__file__), "bin"))')
  PY -m valhalla.valhalla_build_config --mjolnir-tile-dir "$ABS/$OUT/tiles" --mjolnir-tile-extract "$ABS/$OUT/tiles.tar" --mjolnir-timezone "" --mjolnir-admin "" > "$CONF"
  echo "== valhalla_build_tiles (pyvalhalla $(PY -c 'import valhalla; print(valhalla.__version__)'))"
  "$VBIN/valhalla_build_tiles" -c "$CONF" "$PBF"
  PY -m valhalla.valhalla_build_extract -c "$ABS/$CONF" -v || tar -cf "$OUT/tiles.tar" -C "$OUT/tiles" .
fi
echo "== result"
du -sh "$OUT/tiles" "$OUT/tiles.tar" 2>/dev/null || true
find "$OUT/tiles" -name '*.gph' | wc -l | xargs echo "graph tiles:"
gzip -c "$OUT/tiles.tar" | wc -c | awk '{printf "tiles.tar.gz: %.1f MB\n", $1/1048576}'
