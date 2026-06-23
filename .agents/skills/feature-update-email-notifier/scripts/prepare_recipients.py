#!/usr/bin/env python3
"""Validate, de-duplicate, and batch feature-update email recipients.

Supports Clerk JSON exports (`{"data": [...]}` or a list of users) and CSV files
with a primary email column such as `primary_email_address`.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any, Iterable

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    email = value.strip().lower()
    return email if EMAIL_RE.match(email) else None


def email_from_clerk_user(user: dict[str, Any]) -> str | None:
    email_addresses = user.get("email_addresses")
    if not isinstance(email_addresses, list):
        return None

    primary_id = user.get("primary_email_address_id")
    if primary_id:
        for item in email_addresses:
            if isinstance(item, dict) and item.get("id") == primary_id:
                return normalize_email(item.get("email_address"))

    for item in email_addresses:
        if isinstance(item, dict):
            email = normalize_email(item.get("email_address"))
            if email:
                return email
    return None


def iter_clerk_json(path: Path) -> Iterable[tuple[str | None, str | None]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        users = data.get("data", [])
    else:
        users = data
    if not isinstance(users, list):
        raise ValueError(f"{path} does not look like a Clerk users JSON export")

    for user in users:
        if not isinstance(user, dict):
            continue
        user_id = user.get("id") if isinstance(user.get("id"), str) else None
        yield user_id, email_from_clerk_user(user)


def iter_csv(path: Path, email_column: str) -> Iterable[tuple[str | None, str | None]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            user_id = row.get("id") or row.get("user_id") or row.get("clerk_id")
            yield user_id, normalize_email(row.get(email_column))


def batches(values: list[str], batch_size: int) -> list[list[str]]:
    return [values[i : i + batch_size] for i in range(0, len(values), batch_size)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", help="CSV or Clerk JSON files")
    parser.add_argument("--email-column", default="primary_email_address")
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--output", help="Optional JSON output path")
    args = parser.parse_args()

    if args.batch_size < 1:
        raise SystemExit("--batch-size must be positive")

    seen: set[str] = set()
    emails: list[str] = []
    invalid = 0
    duplicates = 0
    rows = 0

    for raw_path in args.paths:
        path = Path(raw_path)
        if not path.exists():
            raise SystemExit(f"Missing input file: {path}")
        iterator = iter_csv(path, args.email_column) if path.suffix.lower() == ".csv" else iter_clerk_json(path)
        for _user_id, email in iterator:
            rows += 1
            if not email:
                invalid += 1
                continue
            if email in seen:
                duplicates += 1
                continue
            seen.add(email)
            emails.append(email)

    grouped = batches(emails, args.batch_size)
    result = {
        "input_rows": rows,
        "valid_unique_emails": len(emails),
        "duplicates": duplicates,
        "invalid_or_missing": invalid,
        "batch_size": args.batch_size,
        "batch_sizes": [len(group) for group in grouped],
        "batches": [",".join(group) for group in grouped],
    }

    payload = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
