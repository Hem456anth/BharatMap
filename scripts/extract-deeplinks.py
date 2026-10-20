#!/usr/bin/env python3
"""Interoperability-only deep-link inventory from user-supplied APKs.

Reads ONLY the binary AndroidManifest.xml and the APK signing block of each APK:
  package, versionName/versionCode, signer certificate SHA-256 (v1/v2/v3), and every <intent-filter> on an
  activity / activity-alias that declares action VIEW + category BROWSABLE (schemes, hosts, ports, path,
  pathPrefix, pathPattern, pathAdvancedPattern, pathSuffix, mimeType, android:autoVerify).
It does NOT open classes*.dex, resources, assets or native libraries, and does not extract keys, secrets or endpoints.

Usage: python3 scripts/extract-deeplinks.py [--uploads DIR] [--out data/deeplinks/apk-manifest-links.json]
Requires androguard 4.x (pip install androguard).
"""
import argparse, hashlib, json, logging, os, re, sys

try:
    from loguru import logger as _lg  # androguard 4 logs through loguru; silence it
    _lg.remove()
except Exception:
    pass
logging.disable(logging.CRITICAL)
from androguard.core.apk import APK  # noqa: E402

NS = '{http://schemas.android.com/apk/res/android}'
VIEW = 'android.intent.action.VIEW'
BROWSABLE = 'android.intent.category.BROWSABLE'

# Files the user uploaded for this pass, keyed by upload name prefix. `skip` keeps an app out of the catalogue.
EXPECTED = {
    'base-543c': {'app': 'BookMyShow', 'package': 'com.bt.bms'},
    'base(1)-': {'app': 'District', 'package': 'com.application.zomato.district'},
    'base(2)-': {'app': 'PhonePe', 'package': 'com.phonepe.app'},
    'base(3)-': {'app': 'Swiggy', 'package': 'in.swiggy.android'},
    'base(4)-': {'app': 'Google Pay', 'package': 'com.google.android.apps.nbu.paisa.user'},
    'base(5)-': {'app': 'Apollo 24|7', 'package': 'com.apollo.patientapp'},
    'base(6)-': {'app': 'Blinkit', 'package': 'com.grofers.customerapp'},
    'base(7)-': {'app': 'EasyPark', 'package': 'net.easypark.android', 'skip': 'Not an India service (not on the user\'s list); analysed only'},
    'base(8)-': {'app': 'Park+', 'package': 'com.ovunque.parkwheels'},
    'base(9)-': {'app': 'Rapido', 'package': 'com.rapido.passenger'},
    'base(10)-': {'app': 'Tata 1mg', 'package': 'com.aranoah.healthkart.plus'},
    'base(11)-': {'app': 'Uber', 'package': 'com.ubercab'},
    'base(12)-': {'app': 'Agoda', 'package': 'com.agoda.mobile.consumer'},
    'base(13)-': {'app': 'MakeMyTrip', 'package': 'com.makemytrip'},
    'base(15)-': {'app': 'Zomato', 'package': 'com.application.zomato'},
    'base-436d': {'app': 'CoMaps', 'package': 'app.comaps.google', 'skip': 'Reference teardown (open source, Apache-2.0; docs/re/COMAPS_TEARDOWN.md), not a hand-off provider'},
}


def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(chunk), b''):
            h.update(b)
    return h.hexdigest()


def certs(apk):
    out = {}
    for label, fn in (('v3', 'get_certificates_der_v3'), ('v2', 'get_certificates_der_v2')):
        try:
            for der in getattr(apk, fn)() or []:
                out.setdefault(hashlib.sha256(der).hexdigest(), set()).add(label)
        except Exception:
            pass
    try:
        for c in apk.get_certificates_v1() or []:
            out.setdefault(hashlib.sha256(c.dump()).hexdigest(), set()).add('v1')
    except Exception:
        pass
    subj = None
    try:
        c = (apk.get_certificates() or [None])[0]
        if c is not None:
            subj = c.subject.human_friendly
    except Exception:
        pass
    return [{'sha256': k, 'schemes': sorted(v)} for k, v in out.items()], subj


def attr(el, name):
    v = el.get(NS + name)
    return v


def redact(v):
    """SDK login schemes embed app ids/keys (Facebook fb<digits>, Kakao kakao<hex>, LINE line.<digits>); keep the shape, drop the id."""
    v = re.sub(r'^fb\d{6,}$', 'fb<app-id>', v)
    v = re.sub(r'^kakao[0-9a-f]{16,}$', 'kakao<app-key>', v)
    v = re.sub(r'^line\.\d{6,}$', 'line.<channel-id>', v)
    return v


def resolver(apk):
    """Resolve @string references used INSIDE manifest <data> attributes (scheme/host values only) via resources.arsc."""
    cache = {}
    try:
        arsc = apk.get_android_resources()
    except Exception:
        arsc = None

    def res(v):
        m = re.match(r'^@(?:[\w:]+/)?([0-9A-Fa-f]{8})$', str(v))
        if not m or arsc is None:
            return None
        rid = int(m.group(1), 16)
        if rid not in cache:
            try:
                vals = {str(val) for _cfg, val in arsc.get_resolved_res_configs(rid) if val is not None}
                cache[rid] = sorted(vals)
            except Exception:
                cache[rid] = []
        return cache[rid]
    return res


def browsable_filters(apk):
    resolve = resolver(apk)
    xml = apk.get_android_manifest_xml()
    app = xml.find('application')
    res = []
    if app is None:
        return res
    for comp in list(app):
        if comp.tag not in ('activity', 'activity-alias'):
            continue
        name = attr(comp, 'name') or ''
        exported = attr(comp, 'exported')
        for f in comp.findall('intent-filter'):
            actions = {attr(a, 'name') for a in f.findall('action')}
            cats = {attr(c, 'name') for c in f.findall('category')}
            if VIEW not in actions or BROWSABLE not in cats:
                continue
            d = {k: set() for k in ('schemes', 'hosts', 'ports', 'path', 'pathPrefix', 'pathPattern', 'pathAdvancedPattern', 'pathSuffix', 'mimeType')}
            for x in f.findall('data'):
                for a, k in (('scheme', 'schemes'), ('host', 'hosts'), ('port', 'ports'), ('path', 'path'), ('pathPrefix', 'pathPrefix'), ('pathPattern', 'pathPattern'),
                             ('pathAdvancedPattern', 'pathAdvancedPattern'), ('pathSuffix', 'pathSuffix'), ('mimeType', 'mimeType')):
                    v = attr(x, a)
                    if v is not None and not str(v).startswith('@'):
                        d[k].add(redact(str(v)))
                    elif v is not None:
                        r = resolve(v)
                        if r:
                            d[k].update(redact(x) for x in r)
                        else:
                            d[k].add(f'<unresolved {v}>')
            av = attr(f, 'autoVerify')
            if av is not None and str(av).startswith('@'):  # @bool resource (e.g. CoMaps sets it per build flavour)
                r = resolve(av)
                av = 'true' if r and any(str(x).lower() in ('true', '-1', '1') for x in r) else 'false'
            entry = {'component': name, 'type': comp.tag, 'exported': exported, 'autoVerify': str(av).lower() == 'true' if av is not None else False,
                     'categories': sorted(c for c in cats if c), **{k: sorted(v) for k, v in d.items() if v}}
            res.append(entry)
    return res


def summarize(filters):
    custom, https = set(), set()
    verified_hosts = set()
    for f in filters:
        sch = f.get('schemes', [])
        for s in sch:
            if s in ('http', 'https'):
                for h in f.get('hosts', ['*']):
                    https.add(h)
                    if f['autoVerify'] and s == 'https':
                        verified_hosts.add(h)
            else:
                custom.add(s)
    return {'customSchemes': sorted(custom), 'webHosts': sorted(https), 'autoVerifyHttpsHosts': sorted(verified_hosts),
            'hasUpiScheme': 'upi' in custom}


def analyse(job):
    path, meta = job
    fn = os.path.basename(path)
    fh = sha256_file(path)
    apk = APK(path)
    pkg = apk.get_package()
    if pkg != meta['package']:
        raise SystemExit(f'{fn}: package {pkg} != expected {meta["package"]}')
    cl, subj = certs(apk)
    filters = browsable_filters(apk)
    return {'app': meta['app'], 'package': pkg, 'versionName': apk.get_androidversion_name(), 'versionCode': apk.get_androidversion_code(),
            'upload': re.sub(r'-[0-9a-f]{12}\.apk$', '.apk', fn), 'apkSha256': fh, 'signers': cl, 'signerSubject': subj,
            'skip': meta.get('skip'), 'summary': summarize(filters), 'browsableFilters': filters}


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument('--uploads', default=os.path.join(os.path.dirname(root), 'files', 'uploads'))
    ap.add_argument('--out', default=os.path.join(root, 'data', 'deeplinks', 'apk-manifest-links.json'))
    ap.add_argument('--jobs', type=int, default=4)
    a = ap.parse_args()
    files = sorted(os.listdir(a.uploads))
    jobs = []
    for prefix, meta in EXPECTED.items():
        fn = next((f for f in files if f.startswith(prefix) and f.endswith('.apk')), None)
        if not fn:
            print(f'missing upload for {prefix} ({meta["app"]})', file=sys.stderr)
            continue
        jobs.append((os.path.join(a.uploads, fn), meta))
    from multiprocessing import Pool
    with Pool(min(a.jobs, len(jobs) or 1)) as pool:
        apps = pool.map(analyse, jobs)
    seen_hash = {r['apkSha256']: r['upload'] for r in apps}
    for rec in apps:
        print(f'{rec["app"]:14} {rec["package"]:42} {rec["versionName"]:>14} filters={len(rec["browsableFilters"]):3} custom={rec["summary"]["customSchemes"][:6]}', file=sys.stderr)
    dupes = []
    for f in files:
        if f.endswith('.apk') and not any(f.startswith(p) for p in EXPECTED) and f.startswith('base'):
            h = sha256_file(os.path.join(a.uploads, f))
            dupes.append({'upload': re.sub(r'-[0-9a-f]{12}\.apk$', '.apk', f), 'apkSha256': h, 'duplicateOf': seen_hash.get(h)})
    out = {'generatedBy': 'scripts/extract-deeplinks.py', 'scope': 'AndroidManifest intent-filters (VIEW+BROWSABLE) and signer certificates only; no code, resources or assets read',
           'androguard': __import__('androguard').__version__, 'apps': apps, 'otherUploads': dupes}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f'wrote {a.out} ({len(apps)} apps)', file=sys.stderr)


if __name__ == '__main__':
    main()
