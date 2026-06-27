---
name: feature-update-email-notifier
description: Draft and optionally send Flowtra feature-update emails to project users. Use when the user asks to notify users about a product release, new model, pricing update, launch announcement, or feature change by email, especially when recipients should come from Clerk users, a Clerk export CSV, or another user CSV, and Gmail drafts/BCC batches are needed.
---

# Feature Update Email Notifier

Use this skill to run Flowtra feature-update email campaigns safely. Default to drafting Gmail messages first; send only after the user explicitly confirms the exact sender, recipients, subject, full body, and draft IDs.

## Recipient Source

Prefer this order:

1. **Clerk live users** when the user says "all users" and has not provided a CSV.
   - Use `$clerk-cli` if available.
   - Run `clerk doctor --json` first.
   - Export pages with `clerk users list --json --limit 250 --offset <n>` into `/tmp`, not into the repo.
   - Extract only user IDs, names, and email addresses. Do not print full Clerk user objects.
2. **Provided CSV** when the user attaches or names a file.
   - Use only the requested email/name columns.
   - Ignore sensitive columns such as passwords, password hashes, phone numbers, secrets, or tokens.
3. **User-provided explicit recipient list** when the user supplies addresses directly.

Use `scripts/prepare_recipients.py` to validate, de-duplicate, and batch recipients from CSV or Clerk JSON files.

Always exclude `lantianlaoli@gmail.com` from recipient lists before batching. This is the owner/sender account and should never be included in BCC recipient batches, even if it appears in Clerk exports, CSV files, or an explicit recipient list.

## Drafting Workflow

1. Gather release facts:
   - Feature name, what changed, where it is available, production URLs, pricing or plan impact, and launch status.
   - If external claims are time-sensitive or model/provider-specific, verify with current docs or web search before writing.
2. Prepare recipients:
   - Batch BCC recipients in groups of 50 by default.
   - Use the connected sender address as `to`; put users only in `bcc`.
   - Remove `lantianlaoli@gmail.com` before batching.
   - Report counts: total rows/users, valid unique emails, owner/sender exclusions, duplicates, invalid/missing, batch sizes.
3. Write concise English email copy:
   - Use Flowtra Team as the signature unless the user specifies another sender identity.
   - Keep feature updates short and concrete.
   - Include the production domain `flowtra.ai` for public links.
   - For pricing, include both credits and approximate USD when available.
   - See `references/release-email-policy.md` for the copy checklist.
4. Create Gmail drafts:
   - Use Gmail `create_draft`, not `send_email`, unless the user explicitly asks to send immediately and has already confirmed the full payload.
   - Use `content_type: text/plain` for simple update emails unless HTML is explicitly requested.
   - Do not attach the recipient CSV or exported Clerk data.
5. Verify drafts:
   - List drafts or otherwise confirm draft IDs, `to`, empty `cc`, BCC counts, subject, snippets/body, and no attachments.
6. Send only after confirmation:
   - Before sending, restate sender, recipient scope, subject, body, and draft IDs.
   - Require a clear confirmation such as "确认发送" or "send these drafts".
   - Then call Gmail `send_draft` for each draft and report sent message IDs.

## Clerk User Email Extraction

The installed Clerk skills do support retrieving user emails:

- `$clerk-cli` documents `clerk users list --json --limit 250`, pagination, and projecting `.data[] | {id, email_addresses}`.
- `$clerk-backend-api` documents `GET /v1/users` and the `email_addresses` user field.

Prefer Clerk CLI because it handles linked app/instance targeting and auth. For production campaigns, confirm the target Clerk app/instance before exporting.

## Safety Rules

- Never send without explicit final confirmation after drafts exist.
- Never expose BCC recipient lists in the final user-facing summary unless the user asks.
- Never include sensitive CSV/Clerk fields in the message body or attachments.
- Never mutate Clerk users as part of a notification task.
- Never include `lantianlaoli@gmail.com` in BCC recipient batches.
- If a Gmail/API send fails mid-batch, stop, report which drafts/messages succeeded, and ask before retrying failed drafts.
