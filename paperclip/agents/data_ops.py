#!/usr/bin/env python3
"""
Data Operations Agent — Paperclip process adapter.

Handles scheduled data maintenance tasks for the TCG Marketplace:
  - Fetch latest card prices from pokemontcg.io
  - Enrich non-English cards with full game data from TCGdex
  - Import new language card sets
  - Check for new sets and report

Paperclip invokes this script as a child process on each heartbeat.
All context arrives via environment variables.

Setup:
  Adapter type : process
  Command      : python
  Args         : ["/path/to/paperclip/agents/data_ops.py"]
  CWD          : /path/to/tcg-marketplace_neo/backend
  Heartbeat    : every 6 hours (21600s) for prices; on-demand for imports
"""

import os
import sys
import json
import subprocess
import requests
from datetime import datetime, timezone

# ── Paperclip context ────────────────────────────────────────────────────────
API_URL    = os.getenv("PAPERCLIP_API_URL", "http://localhost:3100/api")
API_KEY    = os.getenv("PAPERCLIP_API_KEY", "")
AGENT_ID   = os.getenv("PAPERCLIP_AGENT_ID", "")
COMPANY_ID = os.getenv("PAPERCLIP_COMPANY_ID", "")
RUN_ID     = os.getenv("PAPERCLIP_RUN_ID", "")
WAKE       = os.getenv("PAPERCLIP_WAKE_REASON", "timer")

# ── Django project root (the CWD is backend/) ─────────────────────────────
MANAGE = os.path.join(os.getcwd(), "manage.py")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "X-Paperclip-Run-Id": RUN_ID,
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def api(method: str, path: str, **kwargs):
    url = f"{API_URL}/{path.lstrip('/')}"
    resp = getattr(requests, method)(url, headers=HEADERS, **kwargs)
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, {}


def comment(issue_id: str, body: str):
    api("post", f"issues/{issue_id}/comments", json={"body": body})


def close_task(issue_id: str, status: str = "done"):
    api("patch", f"issues/{issue_id}", json={"status": status})


def run_command(args: list[str], task_id: str | None = None) -> tuple[bool, str]:
    """Run a Django management command, return (success, output)."""
    cmd = [sys.executable, MANAGE] + args
    log(f"Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,   # 1 hour max
        )
        output = result.stdout[-3000:] if result.stdout else ""
        if result.returncode != 0:
            err = result.stderr[-1000:] if result.stderr else "(no stderr)"
            return False, f"Exit {result.returncode}:\n{err}"
        return True, output
    except subprocess.TimeoutExpired:
        return False, "Command timed out after 1 hour."
    except Exception as e:
        return False, str(e)


# ── Task handlers ─────────────────────────────────────────────────────────────

def handle_fetch_prices(issue_id: str, title: str):
    """Run fetch_pokemontcg_prices — updates USD/EUR prices for all EN cards."""
    comment(issue_id, "Starting price fetch from pokemontcg.io…")
    ok, output = run_command(["fetch_pokemontcg_prices"])
    if ok:
        comment(issue_id, f"Price fetch complete.\n\n```\n{output[-2000:]}\n```")
        close_task(issue_id, "done")
        log("Price fetch: done")
    else:
        comment(issue_id, f"Price fetch failed:\n```\n{output}\n```")
        close_task(issue_id, "blocked")
        log("Price fetch: failed")


def handle_enrich_language(issue_id: str, title: str):
    """
    Enrich non-English cards with HP/attacks/abilities from TCGdex REST API.
    Task title format: 'enrich <lang>' e.g. 'enrich ja'
    """
    parts = title.lower().split()
    lang = parts[1] if len(parts) >= 2 else "ja"
    comment(issue_id, f"Enriching {lang.upper()} cards from TCGdex REST API…")
    ok, output = run_command(["enrich_language_cards", "--language", lang])
    if ok:
        comment(issue_id, f"Enrichment complete for {lang.upper()}.\n\n```\n{output[-2000:]}\n```")
        close_task(issue_id, "done")
    else:
        comment(issue_id, f"Enrichment failed for {lang.upper()}:\n```\n{output}\n```")
        close_task(issue_id, "blocked")


def handle_import_language(issue_id: str, title: str):
    """
    Import a new language's cards into the DB.
    Task title format: 'import <lang>' e.g. 'import de'
    """
    parts = title.lower().split()
    lang = parts[1] if len(parts) >= 2 else "ja"
    comment(issue_id, f"Importing {lang.upper()} cards…")

    # Step 1: fetch raw data from TCGdex
    ok, output = run_command(["fetch_multi_language_data"])
    if not ok:
        comment(issue_id, f"Fetch step failed:\n```\n{output}\n```")
        close_task(issue_id, "blocked")
        return

    # Step 2: import into DB
    ok, output = run_command(["import_language_cards", "--language", lang])
    if not ok:
        comment(issue_id, f"Import step failed:\n```\n{output}\n```")
        close_task(issue_id, "blocked")
        return

    # Step 3: import translations
    ok2, out2 = run_command(["import_translations", "--lang", lang])

    summary = f"Import complete for {lang.upper()}.\n\n```\n{output[-1500:]}\n```"
    if ok2:
        summary += f"\n\nTranslations:\n```\n{out2[-500:]}\n```"
    comment(issue_id, summary)
    close_task(issue_id, "done")


def handle_scheduled_price_check():
    """
    Timer-based heartbeat: run price fetch automatically if wake reason is 'timer'.
    No task required — just runs and logs output.
    """
    log("Timer heartbeat — running scheduled price fetch…")
    ok, output = run_command(["fetch_pokemontcg_prices"])
    status = "completed" if ok else "failed"
    log(f"Scheduled price fetch {status}.")
    if not ok:
        log(f"Error output:\n{output}")


# ── Task routing ──────────────────────────────────────────────────────────────

TASK_ROUTES = {
    "fetch prices":    handle_fetch_prices,
    "fetch price":     handle_fetch_prices,
    "enrich":          handle_enrich_language,
    "import":          handle_import_language,
}


def route_task(issue_id: str, title: str):
    title_lower = title.lower().strip()
    for keyword, handler in TASK_ROUTES.items():
        if title_lower.startswith(keyword):
            log(f"Routing task '{title}' → {handler.__name__}")
            handler(issue_id, title_lower)
            return
    log(f"No handler for task: '{title}' — marking done")
    comment(issue_id, f"Data Ops agent has no handler for task: `{title}`")
    close_task(issue_id, "done")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log(f"Data Ops agent woke. reason={WAKE} agent={AGENT_ID}")

    # Fetch inbox
    status, inbox = api("get", "agents/me/inbox-lite")
    if status != 200:
        log(f"Could not fetch inbox (HTTP {status}). Exiting.")
        sys.exit(1)

    tasks = inbox if isinstance(inbox, list) else inbox.get("issues", [])
    log(f"Inbox: {len(tasks)} task(s)")

    if tasks:
        for task in tasks:
            issue_id = task.get("id")
            title = task.get("title", "")
            log(f"Processing task: [{issue_id}] {title}")

            # Atomically check out the task
            ck_status, ck_body = api(
                "post", f"issues/{issue_id}/checkout",
                json={"agentId": AGENT_ID, "expectedStatuses": ["todo", "backlog"]}
            )
            if ck_status == 409:
                log(f"Task {issue_id} already checked out — skipping.")
                continue
            if ck_status != 200:
                log(f"Checkout failed (HTTP {ck_status}) — skipping.")
                continue

            route_task(issue_id, title)

    elif WAKE == "timer":
        # No tasks assigned but woke on schedule — run price check
        handle_scheduled_price_check()
    else:
        log("No tasks and not a timer wake — nothing to do.")

    log("Agent heartbeat complete.")


if __name__ == "__main__":
    main()
