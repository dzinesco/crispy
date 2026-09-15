---
title: "The Agent That Audited Itself Out of a $600 Mistake"
description: "A closed-loop Colorado Medicaid RCM agent misread PI:4, then the next 835 proved it wrong — and why the hot path is deterministic Python, not an LLM that bills claims."
pubDate: 2026-09-14
author: "Crispy Goat"
tags:
  - colorado-medicaid
  - claims
  - rcm
  - agents
  - neoclaim
  - billing
---

# The Agent That Audited Itself Out of a $600 Mistake

On August 24 my agent flagged two medical claims denied **PI:4** — procedure inconsistent with modifier. It diagnosed the problem, patched the source JSON, stripped the modifiers, and lined up a resubmit. About **$614** on the line. Seven days later the September 10 remittance came back: same claim shape, denied **PI:4** again — and the modifier was still sitting in the service line. The agent had been confidently wrong. The system I built to catch denials was the thing that proved it.

## The loop (not a chatbot)

This isn’t “ask an LLM about billing.” It’s a closed RCM loop for Colorado Medicaid-style batches:

1. Drop the week’s raw **837P** files in a folder  
2. Parse → wrap → **SFTP** to the clearinghouse  
3. Ingest **999 / TA1** acknowledgments (syntax)  
4. Ingest the **835** remittance (semantics)  
5. Diagnose denials against payer rules and **LQ** (remark) codes  
6. Draft a patch to the source claim JSON  
7. Human approves → rewrap → resubmit  

**SQLite** is the audit trail. Every claim remembers prior ICN, prior service-line payload, source file, and the LQ codes that triggered a patch. Files stay on disk. Context windows are not the system of record.

That shape is the product (see [NeoClaim](https://neoclaim.io)): closed loop, not chat.

## What went wrong

**PI:4** (CARC) reads like a modifier problem: *the procedure code is inconsistent with the modifier used.*

The service line looked like homemaker / IHSS-style coding with modifiers in the **SV1** (think `HC:S5130` plus unit and condition modifiers such as **U2** and **KX**). The agent read PI:4, decided **KX** was invalid for that service, and stripped it. Public HCPF CFC guidance actually allows **KX + U2** for qualifying IHSS cases — so the “fix” was already on thin ice.

The **999** came back accepted. The resubmit went out. Dashboard green. Then the next **835** arrived: denied **PI:4** again. The original modifier story didn’t hold. Looking at the **LQ** remarks properly, the loud **N550**-style modifier noise was secondary. The repeated signal that mattered was **N517** — missing referring provider — stacked on the service lines.

I had treated the loudest, most familiar signal as the diagnosis. The remittance — the same loop meant to detect denials — was what falsified it.

## Why the loop matters

Three boring properties made self-correction possible:

**1. An audit trail you can join.**  
When the second 835 landed, the agent could compare new denial codes to the prior service line and the prior patch. Without `prior_icn`, claim frequency, and raw claim JSON on disk, “we already fixed this” is folklore.

**2. Syntax ≠ semantics.**  
**999/TA1** say the envelope is well-formed. **835** says the payer’s money logic. Most pipelines conflate them. A 999A does not paper over a semantic denial. Separating those layers is how you stop celebrating the wrong green light.

**3. Drafts, not sends.**  
The agent never auto-resubmits. It drafts patches; a human approves. The ~$600 mistake stayed recoverable because the loop closed *before* a second confident wrong resubmit burned another week of cash timing.

## The pattern

Closed-loop beats chat. Self-checking beats self-confident. Drafts-not-sends beats “autonomous.” Files-on-disk beat in-context memory. The agent is shaped by one discipline: **I might be wrong, and the system should be able to prove it.**


## What the LLM doesn't do

The piece above might read like “I built an AI to bill Medicaid.” That’s wrong. Here’s the split.

### The hot path is closed-system Python

Five scripts. Deterministic. Idempotent. Cron or by hand:

1. Strip the **837P** envelope (regex — no inference)
2. Parse X12 → JSON (hand-rolled parser)
3. Write to **SQLite** (`INSERT OR IGNORE`)
4. Wrap each claim with a hardcoded ISA/GS/ST envelope
5. **SFTP** to the Colorado Medicaid clearinghouse (library calls)

None of this is AI. None of it hallucinates. None of it can be wrong about a payer’s modifier rule because it doesn’t try — it doesn’t know the rules. It passes data through. The operator supplies source claims; the scripts shape them; the payer adjudicates. Same physics as 2019, minus the manual spreadsheet.

### Where the LLM actually enters

1. **Reading the 835.** The closed system already landed structured rows — denial codes, payer ICN, CAS segments. The LLM *interprets* a denial by joining those rows against LQ remarks in the raw remittance and the payer’s published rules. Research task, not a billing submit.

2. **Drafting a patch.** When PI:4 + N517 shows up, the LLM proposes a concrete edit: change one SV1 field, or add a referring-provider loop. One operator. One field. It does not invent claim data.

3. **Drafting the note.** Subject + body from templates; money figures stay placeholders for a human to fill before anything leaves the building.

### What the LLM never does

- Auto-resubmit (always a confirm flag; always human-gated)
- Send email (draft only — human clicks)
- Invent a claim control number, diagnosis, procedure code, or prior auth
- Modify hardcoded identifiers (submitter / tax / NPI constants)
- Touch the control-number ledger

### The contrarian point

“AI bills the claims” is the framing people expect. It’s also the framing that breaks first under audit.

LLMs are good at unstructured text — denial narratives, payer manuals, a note to a colleague. They are bad at deterministic record-keeping. Put the LLM where it’s strong (interpretation, drafting). Put Python where it’s strong (pass-through, audit trail). The SQLite claims table is the source of truth. The LLM is an advisor, not an actor.

### Why this matters for compliance

Every claim that hits the clearinghouse has, in claim storage, the exact JSON the wrap step serialized into the 837P. Every payment or denial has the exact 835 row the payer sent. Every resubmit has the prior ICN and the patch reason. If the LLM hallucinates a diagnosis or invents a modifier, the next 999/TA1 or the next 835 fails the story — and the same audit trail catches it.

The closed system is what’s billable to Medicaid. The LLM is what makes a human faster at diagnosing why a $50 claim came back $0.


If your billing AI can’t lose an argument with an 835, it isn’t an RCM agent. It’s a very expensive autocomplete.
