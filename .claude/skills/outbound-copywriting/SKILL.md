---
name: outbound-copywriting
description: Write review-ready, human-sounding 3-step cold email sequences for qualified leads. Use during the outreach-drafting phase for each QUALIFIED lead only. Grounds every claim in the lead's stored source context and produces a personalization note and optional LinkedIn message.
---

# Outbound Copywriting Guide

Use this guide to create review-ready cold outreach drafts for qualified leads.

## Required Output

For each qualified lead, generate a 3-step cold email sequence.

Each step must include:

- Subject line
- Email body
- Personalization note

You may also generate a short LinkedIn message.

Return exactly this shape:

```json
{
  "sequence": [
    {
      "step": 1,
      "subject": "",
      "body": "",
      "personalization_note": ""
    },
    {
      "step": 2,
      "subject": "",
      "body": "",
      "personalization_note": ""
    },
    {
      "step": 3,
      "subject": "",
      "body": "",
      "personalization_note": ""
    }
  ],
  "linkedin_message": ""
}
```

## Suggested Sequence Structure

### Email 1

Open with a relevant observation from the company context, connect it to the offer (an AI automation assistant), and ask a low-pressure question.

Observation → offer → low-pressure question.

### Email 2

Add another relevant angle grounded in evidence:

- workflow bottleneck
- scaling operations
- repetitive manual process
- operational complexity

Tie it to AI automation support.

### Email 3

Keep the final follow-up brief. Invite a reply if the timing or fit is wrong.

## Copy Rules

- Use the company context gathered during research (website positioning, product/service, audience, hiring/scaling signals, public operational clues).
- Keep each email short and direct (aim for 3–6 sentences).
- Write like a person, not a promotion.
- Do not invent details about the company — every specific claim must be traceable to source context.
- Avoid fake urgency, exaggerated claims, and generic praise ("loved what you're building", "your company looks impressive").
- Avoid fake familiarity.
- Do not include personal email addresses unless the user provided them.
- Do not send outreach — these are drafts for human review.
- Do not use markdown bullets or `**bold**` styling in email bodies; plain paragraphs only.

## Personalization

Good personalization references evidence:

- Website positioning
- Product or service category
- Audience served
- Hiring or scaling signal
- Public workflow or operational clue

Weak personalization is vague:

- "Loved what you are building"
- "Your company looks impressive"
- "I saw your website"

## Quality Check

Before finalizing copy, check:

- Does each email mention a real company-specific detail?
- Can each claim be traced to the stored source context?
- Is the ask clear?
- Is the tone calm and credible?
- Would a human want to review this before sending?