#!/usr/bin/env python3
"""
Reconcile the request ledger against what is actually in the tree.

## Why this is a script and not a reading

There are 150 recovered requests. Reading them once and assigning statuses by
memory is exactly how the ledger would rot: the judgement would be unrepeatable,
nobody could check it, and the next reconciliation would start from scratch.

So the evidence is gathered mechanically — commit subjects, tracked file paths,
and test names are searched for each request's distinctive terms — and the
result is a *proposal* with the evidence attached. What the script cannot do is
decide. A keyword hit is a lead, not a delivery, and this script never marks
anything `done` on its own.

## What it will not do, deliberately

- It will not close a request because a commit mentions a similar word. That is
  the paraphrase-closing `docs/ledger/README.md` forbids.
- It will not overwrite a status that a human has already set. Anything not
  `unreconciled` is left exactly as found.

Run: python3 scripts/reconcile-ledger.py [--write]
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs" / "ledger" / "REQUESTS.md"
CORPUS = ROOT / "docs" / "ledger" / "requests-recovered.md"

# Terms that appear in almost every request and therefore identify nothing.
STOP = {
    "التطبيق", "العمل", "كل", "شيئ", "شي", "الان", "هذا", "هذه", "على", "في", "من",
    "الى", "إلى", "مع", "لا", "ما", "او", "أو", "ان", "أن", "يجب", "اريد", "أريد",
    "اكمل", "عمل", "ايضا", "أيضا", "لكن", "قبل", "بعد", "غير", "بكل", "التي", "الذي",
    "and", "the", "for", "with", "that", "this", "you", "our", "app", "all", "make",
}

# Distinctive concept terms → what to look for in the tree. Only concepts that
# leave a durable, searchable trace are listed; a request about "make it better"
# has no trace by design and must stay for a person to judge.
CONCEPTS: list[tuple[str, str, list[str]]] = [
    # (label, regex over the request text, paths/globs that would prove it)
    ("globe", r"كرة|خريطة|globe", ["components/globe-view.tsx"]),
    ("news", r"اخبار|أخبار|news", ["lib/modules/news.ts", "lib/analysis/stories.ts"]),
    ("sources", r"مصدر|مصادر|تغذية|feed", ["lib/engine/catalog"]),
    ("i18n/arabic", r"عربي|ترجم|لغة", ["lib/i18n"]),
    ("pi auth", r"باي|pi network|بي نتورك", ["lib/auth"]),
    ("payments", r"دفع|اشتراك|سعر|pricing", ["lib/payments", "lib/plans"]),
    ("accounts", r"حساب|تسجيل|دخول", ["lib/auth", "app/api/auth"]),
    ("groups", r"مجموع", ["lib/modules/groups.ts"]),
    ("avatar", r"صورة المستخدم|صورتي|avatar", ["lib/modules/avatar.ts"]),
    ("monitoring", r"مراقب|تنبيه|alert", ["lib/alerts"]),
    ("export", r"تصدير|export|pdf", ["lib/modules/brief.ts", "app/api/export"]),
    ("trending", r"رائج|ترند|trending", ["app/api/trending"]),
    ("blockchain", r"بلوكشين|بلوك|chain", ["lib/modules/chain-radar.ts"]),
    ("publishing", r"نشر تلقائي|النشر|منشور|post", ["lib/modules/autopublish.ts"]),
    ("competitors", r"منافس|مشابه|مقارنة", ["docs/COMPETITORS.md"]),
    ("agents", r"وكلاء|وكيل|agent", [".claude/agents"]),
    ("secrets", r"مفاتيح|أسرار|اسرار|secret", ["docs/SECURITY.md", ".env.example"]),
    ("deploy", r"نشر|netlify|deploy|مستودع", ["netlify.toml"]),
    ("database", r"قاعدة بيانات|supabase|database", ["db/schema.ts", "lib/db"]),
    ("api docs", r"وثائق|api|توثيق", ["lib/api-catalog.ts", "app/docs/api"]),
]


def sh(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return ""


def tracked_paths() -> set[str]:
    return set(sh(["git", "ls-files"]).splitlines())


def commit_subjects() -> list[str]:
    return sh(["git", "log", "--format=%h %s"]).splitlines()


def keywords(text: str) -> list[str]:
    words = re.findall(r"[\w؀-ۿ]{4,}", text.lower())
    return [w for w in dict.fromkeys(words) if w not in STOP][:12]


# A question or a continuation is answered in conversation and correctly leaves
# no artifact. Treating those as "ignored" was the first version's mistake: it
# reported 67 untraceable requests, most of which were "اكمل" and "اين اجد
# الرابط". Mislabelling those buries the handful that genuinely were dropped.
CONVERSATIONAL = re.compile(
    r"^(نعم|لا|اكمل|كمل|واصل|تابع|هل |اين |أين |من هو|ما هو|ماهو|كيف |متى |لماذا |"
    r"شكرا|تمام|حسنا|جيد|ممتاز|ok|yes|no|thanks|continue)",
    re.I,
)

def is_conversational(text: str) -> bool:
    t = text.strip()
    if CONVERSATIONAL.match(t) and len(t) < 120:
        return True
    # A bare image with no instruction is context, not a request.
    if t.startswith("[Image:") and len(t) < 200:
        return True
    return False


def evidence_for(text: str, paths: set[str], commits: list[str]) -> list[str]:
    found: list[str] = []
    for label, pattern, proofs in CONCEPTS:
        if not re.search(pattern, text, re.I):
            continue
        present = [p for p in proofs if any(t == p or t.startswith(p + "/") for t in paths)]
        if present:
            found.append(f"{label} → {present[0]}")
    kws = keywords(text)
    for line in commits:
        low = line.lower()
        hits = [k for k in kws if k in low]
        if len(hits) >= 2:
            found.append(f"commit {line[:72]}")
            break
    return found[:3]


def main(write: bool) -> int:
    if not LEDGER.exists():
        print(f"no ledger at {LEDGER}", file=sys.stderr)
        return 1

    paths = tracked_paths()
    commits = commit_subjects()

    # The user's own words live inside the fenced block. Reading the whole
    # section instead would hand the classifier the heading, the repeat dates
    # and the fence markers — which is why the first run classified nothing as
    # conversational: every body began with "```text" and matched no pattern.
    corpus = CORPUS.read_text(encoding="utf-8") if CORPUS.exists() else ""
    bodies: dict[str, str] = {}
    for m in re.finditer(r"### (R\d+)[^\n]*\n(.*?)(?=\n### R|\Z)", corpus, re.S):
        section = m.group(2)
        fenced = re.search(r"```text\n(.*?)\n```", section, re.S)
        bodies[m.group(1)] = (fenced.group(1) if fenced else section).strip()

    lines = LEDGER.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    counts = {"evidence": 0, "none": 0, "already": 0, "conversational": 0}

    for line in lines:
        m = re.match(r"\| \[(R\d+)\]\(([^)]+)\) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| `?([^|]*)`? \| ([^|]*) \|", line)
        if not m:
            # Table rows written by hand have one fewer column; leave untouched.
            out.append(line)
            continue
        rid, link, date, theme, repeats, status, summary = m.groups()
        status = status.strip().strip("`")

        if status != "unreconciled":
            counts["already"] += 1
            out.append(line)
            continue

        text = bodies.get(rid, summary)

        if is_conversational(text):
            counts["conversational"] += 1
            out.append(
                f"| [{rid}]({link}) |{date}|{theme}|{repeats}| `answered` | {summary.strip()} |"
            )
            continue

        ev = evidence_for(text, paths, commits)
        if ev:
            counts["evidence"] += 1
            note = "; ".join(ev).replace("|", "/")
            out.append(
                f"| [{rid}]({link}) |{date}|{theme}|{repeats}| `needs-check` | {summary.strip()} <br>**evidence:** {note} |"
            )
        else:
            counts["none"] += 1
            out.append(f"| [{rid}]({link}) |{date}|{theme}|{repeats}| `open` | {summary.strip()} |")

    print(f"answered in conversation     : {counts['conversational']}  (question or continuation — no artifact expected)")
    print(f"evidence found, needs check  : {counts['evidence']}")
    print(f"REAL ASK, NO TRACE (open)    : {counts['none']}  <- the ones that were actually dropped")
    print(f"already judged by a person   : {counts['already']}")
    print()
    print("`needs-check` means a person must open the request and confirm.")
    print("Nothing was marked done — this script never closes a request.")

    if write:
        LEDGER.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(f"\nwrote {LEDGER}")
    else:
        print("\n(dry run — pass --write to update the ledger)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--write" in sys.argv))
