#!/usr/bin/env python3
"""Public Digital Asset Links check for catalogue providers that did NOT come from a user-supplied APK.

For every official host below it GETs https://<host>/.well-known/assetlinks.json (no cookies, no login, a plain
mobile User-Agent) and records:
  http status, the final URL after redirects, whether the body is a Digital Asset Links JSON array, and for every
  android_app target: package_name, whether the statement grants delegate_permission/common.handle_all_urls, and the
  SHA-256 certificate fingerprints exactly as published (malformed entries are kept verbatim and flagged).
Nothing else is fetched, nothing is decompiled, no APK is downloaded.

A host counts as an App Link host for a package only when the JSON lists that package with handle_all_urls.
Android itself verifies App Links the same way (the app's manifest must also declare the host with autoVerify; we do
not have those APKs, so that half cannot be checked here — see docs/re/DEEPLINKS.md "Web-verified links").

Usage: python3 scripts/fetch-assetlinks.py [--out data/deeplinks/assetlinks-web.json]
"""
import argparse, datetime, json, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
# provider id -> official hosts checked (catalogue host first; apex/www variants and the provider's other official hosts after).
HOSTS = {
    'magicpin': ['magicpin.in', 'www.magicpin.in'],
    'eazydiner': ['www.eazydiner.com', 'eazydiner.com'],
    'ondc': ['ondc.org', 'www.ondc.org'],
    'pvr-inox': ['www.pvrcinemas.com', 'pvrcinemas.com', 'www.inoxmovies.com'],
    'cinepolis': ['www.cinepolisindia.com', 'cinepolisindia.com'],
    'zepto': ['www.zepto.com', 'zepto.com', 'www.zeptonow.com', 'zeptonow.com'],
    'flipkart-minutes': ['www.flipkart.com', 'flipkart.com', 'dl.flipkart.com'],
    'bigbasket': ['www.bigbasket.com', 'bigbasket.com'],
    'jiomart': ['www.jiomart.com', 'jiomart.com'],
    'dmart-ready': ['www.dmart.in', 'dmart.in'],
    'ola': ['book.olacabs.com', 'www.olacabs.com', 'olacabs.com'],
    'namma-yatri': ['nammayatri.in', 'www.nammayatri.in'],
    'bharat-taxi': ['www.bharattaxiapp.com', 'bharattaxiapp.com'],
    'yatri-sathi': ['yatrisathi.in', 'www.yatrisathi.in'],
    'metro-hyderabad': ['ltmetro.com', 'www.ltmetro.com'],
    'metro-chennai': ['chennaimetrorail.org', 'www.chennaimetrorail.org'],
    'metro-delhi': ['www.delhimetrorail.com', 'delhimetrorail.com'],
    'metro-bengaluru': ['english.bmrc.co.in', 'www.bmrc.co.in', 'bmrc.co.in'],
    'metro-mumbai': ['mmrcl.com', 'www.mmrcl.com'],
    'metro-kochi': ['kochimetro.org', 'www.kochimetro.org'],
    'metro-pune': ['www.punemetrorail.org', 'punemetrorail.org'],
    'metro-nagpur': ['www.metrorailnagpur.com', 'metrorailnagpur.com'],
    'metro-ahmedabad': ['www.gujaratmetrorail.com', 'gujaratmetrorail.com'],
    'metro-jaipur': ['transport.rajasthan.gov.in'],
    'metro-lucknow': ['lucknow.upmetrorail.com', 'upmetrorail.com'],
    'metro-kanpur': ['upmetrorail.com', 'kanpur.upmetrorail.com'],
    'metro-noida': ['www.nmrcnoida.com', 'nmrcnoida.com'],
    'metro-kolkata': ['mtp.indianrailways.gov.in'],
    'tgsrtc': ['www.tgsrtc.telangana.gov.in', 'www.tgsrtcbus.in', 'tgsrtcbus.in'],
    'apsrtc': ['www.apsrtconline.in', 'apsrtconline.in'],
    'ksrtc': ['ksrtc.in', 'www.ksrtc.in'],
    'ksrtc-kerala': ['www.keralartc.com', 'keralartc.com', 'onlineksrtcswift.com'],
    'bmtc': ['mybmtc.karnataka.gov.in'],
    'tnstc': ['www.tnstc.in', 'tnstc.in'],
    'mtc-chennai': ['mtcbus.tn.gov.in'],
    'dtc': ['dtc.delhi.gov.in'],
    'best': ['www.bestundertaking.com', 'bestundertaking.com'],
    'pmpml': ['pmpml.org', 'www.pmpml.org'],
    'chalo': ['chalo.com', 'www.chalo.com'],
    'tummoc': ['tummoc.com', 'www.tummoc.com'],
    'irctc': ['www.irctc.co.in', 'irctc.co.in'],
    'booking-com': ['www.booking.com', 'booking.com'],
    'goibibo': ['www.goibibo.com', 'goibibo.com'],
    'cleartrip': ['www.cleartrip.com', 'cleartrip.com'],
    'easemytrip': ['www.easemytrip.com', 'easemytrip.com'],
    'incredible-india': ['www.incredibleindia.gov.in'],
    'parkmate': ['parkmate.in', 'www.parkmate.in'],
    'nhai': ['tis.nhai.gov.in', 'rajmargyatra.nhai.gov.in', 'nhai.gov.in'],
    'highway-delite': ['www.highwaydelite.com', 'highwaydelite.com'],
    'indianoil': ['iocl.com', 'www.iocl.com'],
    'hpcl': ['www.hindustanpetroleum.com', 'hindustanpetroleum.com'],
    'jio-bp': ['www.jiobp.com', 'jiobp.com'],
    'ocm': ['openchargemap.org'],
    'chargezone': ['www.chargezone.co.in', 'chargezone.co.in'],
    'statiq': ['www.statiq.in', 'statiq.in'],
    'tata-ez': ['www.tatapower.com', 'tatapower.com'],
    'netmeds': ['www.netmeds.com', 'netmeds.com'],
    'practo': ['www.practo.com', 'practo.com'],
    'esanjeevani': ['esanjeevani.mohfw.gov.in'],
    '112-india': ['112.gov.in', 'www.112.gov.in'],
    'india-post': ['www.indiapost.gov.in'],
    'shiprocket': ['www.shiprocket.in', 'shiprocket.in'],
    'delhivery': ['www.delhivery.com', 'delhivery.com'],
}
FP = re.compile(r'^([0-9A-F]{2}:){31}[0-9A-F]{2}$')


def fetch(host):
    url = f'https://{host}/.well-known/assetlinks.json'
    rec = {'host': host, 'url': url}
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json,*/*'}), timeout=25)
        body, rec['http'], rec['finalUrl'] = r.read(), r.status, r.geturl()
    except urllib.error.HTTPError as e:
        rec['http'], rec['finalUrl'], body = e.code, e.geturl(), b''
    except Exception as e:  # DNS / TLS / timeout (several government hosts are not reachable from outside India)
        rec['http'], rec['error'] = 0, type(e).__name__
        rec['result'] = 'unreachable'
        return rec
    try:
        data = json.loads(body.decode('utf-8-sig'))
    except Exception:
        data = None
    if not isinstance(data, list):
        rec['result'] = 'no-assetlinks' if rec['http'] in (200, 404, 410) else f'http-{rec["http"]}'
        return rec
    apps = []
    for st in data:
        t = (st or {}).get('target') or {}
        if t.get('namespace') != 'android_app':
            continue
        fps = t.get('sha256_cert_fingerprints') or []
        apps.append({'package': t.get('package_name'), 'handle_all_urls': any('handle_all_urls' in x for x in (st.get('relation') or [])),
                     'sha256': fps, **({'malformed': [f for f in fps if not FP.match(f)]} if any(not FP.match(f) for f in fps) else {})})
    rec['result'] = 'assetlinks' if apps else 'assetlinks-no-android'
    rec['android'] = apps
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='data/deeplinks/assetlinks-web.json')
    a = ap.parse_args()
    hosts = sorted({h for hs in HOSTS.values() for h in hs})
    with ThreadPoolExecutor(16) as ex:
        res = {r['host']: r for r in ex.map(fetch, hosts)}
    out = {
        'scope': 'Public /.well-known/assetlinks.json only (no login, no APK download, no decompiling). One GET per host.',
        'fetched': datetime.date.today().isoformat(),
        'userAgent': UA,
        'providers': {pid: hs for pid, hs in HOSTS.items()},
        'hosts': [res[h] for h in hosts],
    }
    with open(a.out, 'w') as f:
        json.dump(out, f, indent=1, sort_keys=False)
        f.write('\n')
    n = sum(1 for r in res.values() if r['result'] == 'assetlinks')
    print(f'{len(hosts)} hosts, {n} with android assetlinks -> {a.out}', file=sys.stderr)


if __name__ == '__main__':
    main()
