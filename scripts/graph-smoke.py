#!/usr/bin/env python3
"""Smoke-test a graph built by scripts/build-graph.sh with the pyvalhalla Actor (no server, fully offline).
   python3 scripts/graph-smoke.py osm/graph/vizag/valhalla.json
Run from any directory except the repo root's ./valhalla data folder (it shadows the pyvalhalla package)."""
import sys, time, os
sys.path = [p for p in sys.path if os.path.abspath(p or '.') != os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))]
from valhalla import Actor

conf = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'osm/graph/vizag/valhalla.json')
actor = Actor(conf)
FROM = (17.7289, 83.305)  # Dwaraka Nagar, Visakhapatnam
CASES = [('RK Beach', 'auto', (17.714, 83.323)), ('RK Beach', 'motor_scooter', (17.714, 83.323)),
         ('Simhachalam temple', 'auto', (17.7663, 83.2505)), ('Gajuwaka', 'pedestrian', (17.6814, 83.213))]
for name, costing, to in CASES:
    t = time.time()
    r = actor.route({'locations': [{'lat': FROM[0], 'lon': FROM[1]}, {'lat': to[0], 'lon': to[1]}], 'costing': costing, 'directions_options': {'units': 'kilometers'}})
    s = r['trip']['summary']
    print(f"{name:20s} {costing:14s} {s['length']:6.2f} km {s['time'] / 60:6.1f} min {len(r['trip']['legs'][0]['maneuvers']):3d} maneuvers {(time.time() - t) * 1000:5.0f} ms")
os._exit(0)  # the Actor keeps worker threads alive; exit without waiting for them
