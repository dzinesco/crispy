---
title: "The Banks Locked the AI Agents Out This Week. Good."
description: "JPMorgan, Schwab, Delta and Amazon all told agents no in October, while every new small-business agent launched with an approve button. Same lesson both ways: give agents a front door, not your password."
pubDate: 2026-10-20T15:30:00.000Z
author: "Crispy Goat"
heroImage: "/images/blog/cover-agents-front-door-not-your-password.webp"
tags:
  - ai-agents
  - small-business
  - security
---

Two kinds of AI agent news landed in October, and they look like opposites. They're the same story.

**The doors closed.** On October 13, Jamie Dimon said on JPMorgan's earnings call that the bank won't let "just any … outside agent" into customer accounts, and the bank confirmed to [CNBC](https://www.cnbc.com/2026/10/13/jpmorgan-ai-agents-account-access.html) that it blocks agents that log in with a customer's banking password. Three days later Schwab's CEO told Bloomberg it's blocking agents that try to move client money, Meta's Muse included, and that it stops the big agents tens of times a week ([The Next Web](https://thenextweb.com/news/schwab-blocks-ai-agents-meta-muse)). Delta says it has no integration that lets a third-party agent book its flights, and Amazon has been blocking Muse since September ([Ancilair](https://ancilair.com/news/ai-agents-blocked-airlines-apis-not-logins)).

**The launches all shipped an approve button.** Meta's [Muse for Small Business](https://www.retaildive.com/news/meta-debuts-ai-agent-muse-small-businesses/831890/) plugs into Shopify, Stripe, QuickBooks and Canva, and lets owners require approval before it buys or publishes anything. Wix's Symphony agents can now [pay bills and reorder stock through Stripe's Link wallet](https://www.globenewswire.com/news-release/2026/10/15/3381745/0/en/symphony-by-wix-integrates-link-s-wallet-for-agents-built-by-stripe-enabling-ai-agents-to-make-payments-on-behalf-of-small-businesses.html), with every purchase approved first. [Xero's new Gemini app](https://www.xero.com/us/media-releases/xero-brings-real-time-financial-intelligence-to-google-gemini/) reads your books live, but anything that changes financial data, like sending an invoice or a payment reminder, waits for an explicit yes.

## The pattern

Read those together and the rule is plain:

- **Agents that come in through a front door get in.** An API, an official connector, a read-only link the company controls. Schwab is even building [MCP](https://modelcontextprotocol.io/) servers so outside AI can check balances and do research, but not move money.
- **Agents that come in wearing your password get kicked out**, often halfway through the job.
- **Anything that spends money or talks to the public waits for a human.**

None of that is anti-AI. It's the same rule I already run at home. I've got a whole pile of bots doing real work for me, and the only reason I sleep fine is that they read freely, draft freely, and wait for my yes before anything that writes, sends, or pays. I wrote about the home version of this already: [put agents behind a bridge](https://crispygoat.com/blog/home-assistant-bridge-setup) instead of handing them your whole network, and [keep your Tesla login off every bot](https://crispygoat.com/blog/tesla-behind-home-assistant).

## If you run a small shop

Whether you're in Grand Junction or Grand Rapids, here's the cheap version of what the banks figured out:

1. **Connect, don't log in.** If your bookkeeping, store, or calendar has an official connector for the agent you use, use it. If the only way in is typing your password into the bot, that's the warning sign.
2. **Start read-only.** Let it summarize the books and flag the overdue invoices for a month before it's allowed to touch them.
3. **Keep the approve step on for money and for anything customers will see.** Every vendor is shipping it. Leave it on, even when it's tempting to turn it off.
4. **Expect some doors to stay shut.** If your bank says no to agents, it's not broken. Use the bank's own read-only exports or an approved connector and keep the payments in your hands.

The agent hype this month was "it finishes the job for you." The fine print, from the people holding the money, is "only through the front door, and only after you say yes." That's the right deal. Take it.
