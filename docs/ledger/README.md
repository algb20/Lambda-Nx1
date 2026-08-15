# The request ledger — the standing rule

> **Every instruction goes in this ledger, in full detail, the moment it is
> given. It stays open until it is done. When it is done it moves to done, with
> the commit that did it. Nothing is closed by paraphrase, and nothing is closed
> because it was not repeated.**

This is rule zero for the project, and it exists because of a measured failure,
not a preference.

## The failure it fixes

On 2026-08-15 the observation was made that the same requests were being given
repeatedly and not carried out, and that hundreds of instructions had been lost.
That was correct, and it was verifiable.

The complete session record — 78 MB across three transcript files, covering
2026-07-28 to 2026-08-15 — was mined. It contains **150 distinct instruction
messages carrying 1,510 individual instructions**, an average of ten per
message. The estimate of "700+ requests" was correct.

**A correction, because this file exists to be trusted.** A first pass reported
224 messages and 1,936 verbs. That was wrong: it counted harness text as user
speech — *"Continue from where you left off"* alone appeared 44 times, along
with session-continuation notices and stop-hook output. The second pass strips
those and separately recovers **mid-turn messages**, which the first pass
dropped entirely because the harness wraps them in a prefix. Thirteen asks had
to be given more than once, and the `repeats` column now records how many
times — that count is the evidence, not the complaint.

None of them were lost by the system. They were lost because **nothing ever
wrote them down**. The task tool held 77 engineering tasks, every one of them
authored by the assistant, and not one of them was the user's own words. So a
request that was not acted on immediately had nowhere to live, and the only
recovery mechanism was the user noticing and repeating it.

That is a defect in how the work is organised, and it is the reason a
five-minute fix could stay open for days while large features shipped past it.

## The files

| File | What it is | May be edited? |
|---|---|---|
| `requests-recovered.md` | The **verbatim corpus** — every substantive instruction, unedited, dated, numbered R001–R224. | **No.** Append-only history. |
| `REQUESTS.md` | The **working list** — each item with status, owner, evidence, and the commit that closed it. | Yes, by adding and by changing status. |

`requests-recovered.md` is deliberately unedited and unsummarised. A request
paraphrased is a request half-heard, and summarising the corpus would
reintroduce exactly the failure it documents.

## How it works

1. **On every new instruction** — before any code is written — the request is
   appended to `REQUESTS.md` with its verbatim text, the date, and status
   `open`. Multi-part instructions become multiple entries, because a message
   containing six asks that is marked done after two is the failure mode this
   whole mechanism exists to prevent.
2. **Status is one of:** `open`, `in-progress`, `done`, `blocked`, `declined`.
   - `done` requires a commit hash or a file path. "It is handled" is not a
     status.
   - `blocked` requires the reason and what would unblock it.
   - `declined` requires the reason and must have been said out loud to the
     user. Silence is not a decline.
3. **Nothing is closed by inference.** If a later, larger piece of work happens
   to cover an earlier request, the earlier entry is closed explicitly with a
   pointer to it — never left to be assumed.
4. **The ledger is reconciled against the corpus.** Any entry in
   `requests-recovered.md` with no corresponding line in `REQUESTS.md` is an
   open request, whatever anyone remembers.

## The second rule, which the first one serves

> **Without a plan and its branches, nothing happens for years.**

A ledger of 224 items is a list, not a plan. The list becomes a plan when every
item is attached to a branch of work with an owner and an order. That is what
`REQUESTS.md` does with its `theme` column, and it is why the themes are few
and the items are many rather than the reverse.

## Secrets, and a leak that already happened

The corpus is generated from a conversation, and a conversation about setting up
a database contains the database password — because it was pasted while asking
why a connection was failing.

The first generated ledger therefore committed **live Postgres connection
strings** to a repository that is going to be public. `lib/security/secret-scan.test.ts`
caught it, which is the one good part of the story. The rest is that an explicit
standing instruction — never put keys or secrets in files — was broken by the
mechanism built to honour the user's instructions.

**Every file written from recovered conversation now passes through
`scripts/redact.py` before it is written.** Verbatim and safe are not in
conflict, but only when the redaction is part of generating the file rather than
something remembered afterwards.

**Redaction does not undo a leak.** A credential that reached a commit is
compromised and must be rotated at the provider. Scrubbing the file only stops
it spreading further.
