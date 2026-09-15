---
title: "EVV → Claim: Where Home Care Revenue Actually Leaks"
description: "How Electronic Visit Verification breaks Colorado home care cash flow — and the boring fixes that stop claims from dying between the visit and the 837."
pubDate: 2026-09-14
author: "Crispy Goat"
tags:
  - evv
  - colorado-medicaid
  - home-care
  - billing
  - claims
heroImage: "/images/blog-evv-claim-leaks.png"
---

# EVV → Claim: Where Home Care Revenue Actually Leaks

Care happened. The client got the visit. The caregiver clocked time. Then the claim died somewhere between EVV and the payer.

That gap is where Colorado home care agencies bleed cash — quietly, week after week.

## EVV is not billing

Electronic Visit Verification proves a visit occurred (who, when, where, roughly). Billing is a different sport: turn that evidence into a claim the payer will accept, pay, and not claw back later.

Treating EVV as “done = paid” is how agencies invent fake revenue on the dashboard.

## The leak map (generic, no secrets)

Most leakage clusters in five places:

1. **Visit vs authorization mismatch**  
   Hours, service codes, or units on the visit do not match what is authorized. EVV can look perfect and the claim still fails.

2. **Clock truth vs claim truth**  
   EVV shows one start/stop. The claim uses rounded, edited, or manually rebuilt times. Payers notice patterns. So do auditors.

3. **Late or missing EVV before claim push**  
   Claim goes out before EVV is complete, corrected, or accepted. You get rejects, holds, or “come back later” loops that eat staff time.

4. **Identity and enrollment fog**  
   Wrong member ID format, outdated eligibility, provider NPI / taxonomy quirks. Not sexy. Extremely expensive.

5. **Manual rebuilds**  
   Someone re-types visit data into a spreadsheet or portal because systems do not talk. Every re-key is a new error factory.

None of this requires a conspiracy. It requires entropy — and entropy always wins unless you design against it.

## What “good” looks like

A sane EVV → claim pipeline is boring:

- **One operational source of truth** for visits (not email threads)
- **Hard gates**: no claim submit until EVV state is claim-ready
- **Reject taxonomy**: every deny/reject maps to a fix owner and a next action
- **Cycle time**: measure hours from visit-complete → clean claim, not just “claims filed this week”
- **File discipline**: if humans must move data, use a controlled intake (portal / secure drop), not inbox archaeology

If your team’s hero skill is “knows which attachment was the real one,” you do not have a billing system. You have folklore.

## Colorado angle (high level)

Colorado Medicaid home care lives in a world of EVV requirements plus payer claim rules. The agencies that stay liquid treat those as **one pipeline**, not two departments that meet at month-end.

Public process language from HCPF / CMS / EVV vendors matters more than tribal knowledge locked in one biller’s head. Document the path. Train the path. Instrument the path.

## Where NeoClaim fits

[NeoClaim](https://neoclaim.io) is aimed at the middle: take agency files / operational exports, shape them toward payer-ready claims work, and close the loop on what failed — so EVV and billing stop living in separate realities.

Crispy Goat’s bias: **delete email as the system of record.** Post files. Track status. Fix rejects like engineering defects.

## Do this week

Pick last month’s unpaid visits and ask only:

1. Did EVV complete before claim attempt?
2. Did claim units match authorization?
3. How many rejects were “we retyped something”?

If those three questions feel uncomfortable, that is the product opportunity — and the consulting opportunity — sitting on your AR aging.

When you want a file-intake billing path instead of another spreadsheet ritual, start at [NeoClaim](https://neoclaim.io) or [Crispy Goat](https://crispygoat.com/apply/).

*Process language only. No client data. No PHI.*
