#!/usr/bin/env bash
# Builds OSRM routing data for India (~1.6 GB PBF; needs ~16 GB RAM for extract).
set -euo pipefail
mkdir -p osm && cd osm
[ -f india-latest.osm.pbf ] || curl -L -o india-latest.osm.pbf https://download.geofabrik.de/asia/india-latest.osm.pbf
IMG=ghcr.io/project-osrm/osrm-backend:v5.27.1
docker run --rm -v "$PWD:/data" $IMG osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
docker run --rm -v "$PWD:/data" $IMG osrm-partition /data/india-latest.osrm
docker run --rm -v "$PWD:/data" $IMG osrm-customize /data/india-latest.osrm
echo "OSRM data ready in ./osm"
