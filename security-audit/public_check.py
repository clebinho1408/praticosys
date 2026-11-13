"""Passive public static-file inspection. No API requests or submitted credentials."""
import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://praticosys.com.br/"
root = Path(__file__).resolve().parents[1]
observations = []
all_source = []


def get(relative):
    url = urllib.parse.urljoin(BASE, relative)
    if urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(BASE).netloc:
        return None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "PraticoSys-authorized-passive-audit/1.0"}), timeout=20) as res:
            data = res.read(6_000_000)
            headers = {key.lower(): value for key, value in res.headers.items() if key.lower() in {
                "content-type", "content-security-policy", "x-frame-options", "x-content-type-options",
                "strict-transport-security", "referrer-policy", "permissions-policy", "server",
            }}
            observations.append({"path": relative, "status": res.status, "bytesRead": len(data), "headers": headers})
            return data
    except urllib.error.HTTPError as error:
        observations.append({"path": relative, "status": error.code})
    except Exception as error:
        observations.append({"path": relative, "errorType": type(error).__name__})
    return None


html = get("/")
html_hash = hashlib.sha256(html).hexdigest() if html else None
if html:
    all_source.append(("/", html))
    refs = re.findall(rb'(?:src|href)=["\']([^"\']+\.(?:js|css))["\']', html)
    for raw in refs[:8]:
        path = raw.decode(errors="replace")
        data = get(path)
        if data:
            all_source.append((path, data))
            if path.endswith(".js"):
                maps = re.findall(rb"sourceMappingURL=([^\s*]+)", data)
                observations[-1]["sourceMapReferenced"] = bool(maps)
                for map_url in maps[:1]:
                    # No remote domains or data URIs.
                    full = urllib.parse.urljoin(urllib.parse.urljoin(BASE, path), map_url.decode(errors="replace"))
                    if urllib.parse.urlsplit(full).netloc == urllib.parse.urlsplit(BASE).netloc:
                        get(urllib.parse.urlsplit(full).path)
                observations[-1]["credentialFormatMatchCount"] = len(re.findall(
                    rb"(?:postgres(?:ql)?://[^\s'\"<>]+:[^\s'\"<>]+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]{20,})", data, re.I))
    for candidate in ["/.env", "/.env.local", "/.git/HEAD", "/.migration-backup/.env.railway"]:
        response = get(candidate)
        if response:
            observations[-1]["sameAsRootHtml"] = hashlib.sha256(response).hexdigest() == html_hash
            observations[-1]["looksLikeHtml"] = bool(re.search(rb"<!doctype html|<html", response[:500], re.I))
            observations[-1]["credentialFormatMatchCount"] = len(re.findall(
                rb"(?:postgres(?:ql)?://[^\s'\"<>]+:[^\s'\"<>]+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)", response, re.I))

report = {
    "date": "2026-11-13", "base": BASE, "observations": observations,
    "limitations": ["static GET only; no production API calls", "no private logs or credential validity tested", "heuristic patterns do not cover all secret types", "no authenticated production session used"],
}
(root / "security-audit/public-observations.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
