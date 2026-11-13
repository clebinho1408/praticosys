"""Read-only repository scan. Never prints or stores matched credential values.

Heuristic candidate inventory, NOT credential validity verification.
No process environment, external connections, or credential validation is used.
"""
import collections
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
patterns = {
    "credential_connection_string": re.compile(rb"(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s'\"<>]+:[^\s'\"<>]+@[^\s'\"<>]+", re.I),
    "private_key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "provider_token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk_(?:live|test)_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b"),
    "literal_api_secret": re.compile(rb"(?:API[_-]?(?:KEY|TOKEN|FULL_TOKEN)|APICPF_API_KEY|SESSION_SECRET|DATA_ENCRYPTION_KEY|DATABASE_URL|DATA_BASE_NEON|RESEND_API_KEY)[\"']?\s*[=:]\s*[\"']?([A-Za-z0-9_./:+@?&=%!-]{16,})", re.I),
    "literal_bearer": re.compile(rb"Bearer\s+([A-Za-z0-9_.-]{24,})"),
}


def candidates(data):
    findings = []
    for category, pattern in patterns.items():
        for match in pattern.finditer(data):
            value = (match.group(1) if match.lastindex else match.group()).lower()
            # This is a heuristic; uncertain candidates remain classified, not verified.
            if any(marker in value for marker in [
                b"example", b"placeholder", b"your_", b"sua_", b"seu_", b"test_token", b"aqui", b"change",
                b"synthetic", b"ficticio", b"localhost", b"127.0.0.1",
                b"user:pass", b"usuario:senha", b"neon_user:neon_pass",
            ]):
                continue
            findings.append({"category": category, "line": data[:match.start()].count(b"\n") + 1})
    return findings


tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).split(b"\0")
current = []
scanned = skipped = 0
for raw in tracked:
    if not raw:
        continue
    path = raw.decode(errors="replace")
    p = ROOT / path
    if not p.is_file() or p.stat().st_size > 2_000_000:
        skipped += 1
        continue
    data = p.read_bytes()
    if b"\0" in data:
        skipped += 1
        continue
    scanned += 1
    hits = candidates(data)
    if hits:
        current.append({"path": path, "matches": hits})

# Unique reachable blobs, not a dump of diffs or commit messages.
objects = subprocess.check_output(["git", "rev-list", "--objects", "--all"], cwd=ROOT).splitlines()
blob_paths = {}
for row in objects:
    parts = row.split(b" ", 1)
    if len(parts) == 2:
        blob_paths[parts[0].decode()] = parts[1].decode(errors="replace")
batch = subprocess.run(
    ["git", "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    input=("\n".join(blob_paths) + "\n").encode(), stdout=subprocess.PIPE, check=True, cwd=ROOT,
)
history = []
history_scanned = history_skipped = 0
for row in batch.stdout.decode().splitlines():
    fields = row.split()
    if len(fields) != 3 or fields[1] != "blob":
        continue
    oid, _, size = fields
    if int(size) > 2_000_000:
        history_skipped += 1
        continue
    data = subprocess.check_output(["git", "cat-file", "blob", oid], cwd=ROOT)
    if b"\0" in data:
        history_skipped += 1
        continue
    history_scanned += 1
    hits = candidates(data)
    if hits:
        # Object ids identify source versions, never fingerprints of credentials.
        history.append({"path": blob_paths[oid], "sourceObject": oid, "matches": hits})

uploads = []
uploads_scanned = 0
for p in (ROOT / "attached_assets").glob("*.txt"):
    if p.stat().st_size > 2_000_000:
        continue
    uploads_scanned += 1
    hits = candidates(p.read_bytes())
    if hits:
        uploads.append({"path": p.relative_to(ROOT).as_posix(), "matches": hits})

report = {
    "date": "2026-11-13", "scope": "tracked working tree and reachable Git blobs <=2MB",
    "limitations": ["heuristic candidates only; validity untested", "binary and >2MB blobs excluded", "other untracked/ignored files excluded", "no environment values read"],
    "current": {"textFilesScanned": scanned, "filesSkipped": skipped, "findings": current},
    "history": {"textBlobsScanned": history_scanned, "blobsSkipped": history_skipped, "findings": history},
    "uploadedText": {"filesScanned": uploads_scanned, "findings": uploads},
}
out = ROOT / "security-audit/secrets-inventory.json"
out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({
    "currentTextFiles": scanned,
    "currentCandidateFiles": len(current),
    "historyTextBlobs": history_scanned,
    "historyCandidateBlobs": len(history),
    "currentCandidates": current,
    "uploadedTextFiles": uploads_scanned,
    "uploadedCandidateFiles": len(uploads),
}, ensure_ascii=False))
