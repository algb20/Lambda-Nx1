#!/usr/bin/env python3
"""
Strip credentials out of anything recovered from a conversation.

## Why this exists

The request ledger is generated from the session transcript, verbatim and
deliberately unedited — a request paraphrased is a request half-heard. But a
conversation about setting up a database contains the database password,
because the user pasted it while asking why a connection failed.

So the first generated ledger committed **live Postgres connection strings** to
a repository that is going to be public. The project's own secret scanner caught
it (`lib/security/secret-scan.test.ts`), which is the one good part of the
story; the rest is that a rule the user had stated explicitly — never put keys
or secrets in files — was broken by the very mechanism built to respect their
instructions.

Verbatim and safe are not in conflict, but only if the redaction is part of
generating the file rather than something remembered afterwards. This module is
that part. Any script that writes recovered conversation to disk imports it.

## What it does not do

It does not pretend redaction undoes a leak. A credential that reached a commit
is compromised and must be rotated; scrubbing the file only stops it spreading
further. That is stated in `docs/ledger/README.md` rather than left implied.
"""
from __future__ import annotations

import re

# Ordered most-specific first, so a connection string is redacted whole rather
# than having its password matched separately and its host left behind.
PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Database URLs carry user:password@host in one token.
    (
        re.compile(r"(postgresql|postgres|mysql|mongodb(?:\+srv)?|redis|amqp)://[^\s\"'<>)）]+", re.I),
        r"\1://[REDACTED-CONNECTION-STRING]",
    ),
    # JWTs — Supabase anon/service keys, session tokens.
    (re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"), "[REDACTED-JWT]"),
    # Vendor key formats.
    (re.compile(r"\bsb[ps]_[A-Za-z0-9_-]{20,}\b"), "[REDACTED-KEY]"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), "[REDACTED-KEY]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"), "[REDACTED-TOKEN]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED-AWS-KEY]"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"), "[REDACTED-SLACK-TOKEN]"),
    # An explicit assignment of something named like a secret.
    (
        re.compile(
            r"\b((?:DB|DATABASE|API|SECRET|PRIVATE|ACCESS|AUTH|SESSION|PI)[A-Z_]*"
            r"(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PWD)\s*[:=]\s*)"
            r"['\"]?[^\s'\"]{8,}",
            re.I,
        ),
        r"\1[REDACTED]",
    ),
]


def redact(text: str) -> str:
    """Return `text` with every recognised credential replaced."""
    for pattern, replacement in PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact_file(path: str) -> bool:
    """Redact a file in place. Returns True if anything changed."""
    with open(path, encoding="utf-8") as handle:
        original = handle.read()
    cleaned = redact(original)
    if cleaned == original:
        return False
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(cleaned)
    return True


if __name__ == "__main__":
    import sys

    changed = [p for p in sys.argv[1:] if redact_file(p)]
    for p in changed:
        print(f"redacted {p}")
    print(f"{len(changed)} file(s) changed")
