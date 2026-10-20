#!/usr/bin/env python3
"""LogHunt in the terminal: the same 12 cases, streak rules and sample data as the web version.

Uses only the Python standard library (Python 3.8 or newer).

  python3 loghunt.py                             play today's case
  python3 loghunt.py today
  python3 loghunt.py practice                    list cases and pick one to play
  python3 loghunt.py practice --topic Malware --severity High
  python3 loghunt.py progress                    stats and badges
  python3 loghunt.py notes                       show your notes
  python3 loghunt.py notes --export notes.txt    save notes to a text file
  python3 loghunt.py friends                     demo leaderboard
  python3 loghunt.py team                        demo team challenge

Progress is saved to ~/.loghunt/progress.json. Set LOGHUNT_HOME to use another folder.
"""

import argparse
import datetime as dt
import json
import math
import os
import re
import shutil
import sys
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("LOGHUNT_HOME", str(Path.home() / ".loghunt")))
PROGRESS_FILE = DATA_DIR / "progress.json"
NOTE_MAX = 2000
EPOCH = dt.date(2026, 1, 1)

CASES = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
CASE_BY_ID = {case["id"]: case for case in CASES}
TOPICS = sorted({case["topic"] for case in CASES})
DIFFICULTIES = ["Easy", "Medium", "Hard"]
SEVERITIES = ["Low", "Medium", "High", "Critical"]

BADGES = [
    ("First Hunt", "Solve your first case.", lambda s: s["solved"] >= 1),
    ("Halfway There", "Solve 6 cases.", lambda s: s["solved"] >= 6),
    ("Full Coverage", "Solve all 12 cases.", lambda s: s["solved"] >= len(CASES)),
    ("Three in a Row", "Finish the daily case 3 days in a row.", lambda s: s["bestStreak"] >= 3),
    ("Clean Sweep", "Get 5 or more answers right with no misses.",
     lambda s: s["attempts"] >= 5 and s["correct"] == s["attempts"]),
]

# Sample data for the demo pages. Same names and numbers as the web version.
FRIENDS = [
    {"name": "Ava K.", "solved": 11, "bestStreak": 9},
    {"name": "Marcus T.", "solved": 9, "bestStreak": 5},
    {"name": "Priya S.", "solved": 7, "bestStreak": 3},
    {"name": "Dev R.", "solved": 4, "bestStreak": 1},
]
TEAM = {
    "name": "Blue Team Sprint",
    "goal": 12,
    "members": [
        {"name": "Ava K.", "solved": 4},
        {"name": "Marcus T.", "solved": 3},
        {"name": "Priya S.", "solved": 2},
    ],
}


# ---------- saved progress ----------

def default_state():
    return {"results": {}, "daily": {}, "notes": {}, "streak": 0, "bestStreak": 0, "lastDaily": None}


def _is_count(n):
    return isinstance(n, int) and not isinstance(n, bool) and 0 <= n <= 1_000_000


def _is_day(s):
    return isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) is not None


def _is_case_id(v):
    return isinstance(v, int) and not isinstance(v, bool) and v in CASE_BY_ID


def _as_dict(v):
    return v if isinstance(v, dict) else {}


def load_state():
    """Rebuild saved progress from known fields only. Anything unexpected is dropped."""
    fresh = default_state()
    try:
        saved = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fresh
    if not isinstance(saved, dict):
        return fresh

    for cid, r in _as_dict(saved.get("results")).items():
        if cid.isdigit() and int(cid) in CASE_BY_ID and isinstance(r, dict):
            attempts, correct = r.get("attempts"), r.get("correct")
            if _is_count(attempts) and _is_count(correct) and correct <= attempts:
                fresh["results"][cid] = {"attempts": attempts, "correct": correct}

    for day, d in _as_dict(saved.get("daily")).items():
        if _is_day(day) and isinstance(d, dict) and _is_case_id(d.get("caseId")):
            case = CASE_BY_ID[d["caseId"]]
            picked = d.get("picked")
            if isinstance(d.get("correct"), bool) and _is_count(picked) and picked < len(case["lines"]):
                fresh["daily"][day] = {"caseId": case["id"], "picked": picked, "correct": d["correct"]}

    for cid, text in _as_dict(saved.get("notes")).items():
        if cid.isdigit() and int(cid) in CASE_BY_ID and isinstance(text, str):
            fresh["notes"][cid] = text[:NOTE_MAX]

    if _is_count(saved.get("streak")):
        fresh["streak"] = saved["streak"]
    if _is_count(saved.get("bestStreak")):
        fresh["bestStreak"] = saved["bestStreak"]
    if _is_day(saved.get("lastDaily")):
        fresh["lastDaily"] = saved["lastDaily"]
    return fresh


def save_state(state):
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = PROGRESS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
        tmp.replace(PROGRESS_FILE)
    except OSError as err:
        print(f"Could not save progress: {err}", file=sys.stderr)


# ---------- dates, streaks, stats ----------

def today_key():
    return dt.date.today().isoformat()


def yesterday_key():
    return (dt.date.today() - dt.timedelta(days=1)).isoformat()


def daily_case(day_key):
    days = (dt.date.fromisoformat(day_key) - EPOCH).days
    return CASES[days % len(CASES)]


def current_streak(state):
    return state["streak"] if state["lastDaily"] in (today_key(), yesterday_key()) else 0


def get_stats(state):
    results = list(state["results"].values())
    attempts = sum(r["attempts"] for r in results)
    correct = sum(r["correct"] for r in results)
    return {
        "solved": sum(1 for r in results if r["correct"] > 0),
        "attempts": attempts,
        "correct": correct,
        "accuracy": math.floor(correct / attempts * 100 + 0.5) if attempts else 0,
        "streak": current_streak(state),
        "bestStreak": state["bestStreak"],
    }


def record_attempt(state, case, picked, daily):
    correct = picked == case["answer"]
    key = str(case["id"])
    r = state["results"].get(key, {"attempts": 0, "correct": 0})
    r["attempts"] += 1
    r["correct"] += int(correct)
    state["results"][key] = r

    today = today_key()
    if daily and today not in state["daily"]:
        state["daily"][today] = {"caseId": case["id"], "picked": picked, "correct": correct}
        state["streak"] = state["streak"] + 1 if state["lastDaily"] == yesterday_key() else 1
        state["lastDaily"] = today
        state["bestStreak"] = max(state["bestStreak"], state["streak"])
    save_state(state)
    return correct


# ---------- display ----------

def width():
    return min(shutil.get_terminal_size((100, 24)).columns, 100)


def show_case(case):
    title = case["title"]
    print()
    print(title)
    print("=" * len(title))
    print(f"Topic: {case['topic']}   Difficulty: {case['difficulty']}   Severity: {case['severity']}")
    print()
    print(textwrap.fill(case["scenario"], width()))
    print()
    for i, line in enumerate(case["lines"], 1):
        print(textwrap.fill(line, width(), initial_indent=f"{i:>3}  ", subsequent_indent=" " * 5))
    print()


def show_result(case, correct):
    if correct:
        print("Correct.", end=" ")
    else:
        print(f"Not quite. The turning point is line {case['answer'] + 1}.", end=" ")
    print(textwrap.fill(case["explanation"], width()))
    print()


# ---------- actions ----------

def ask_line(count):
    while True:
        raw = input(f"Which line shows the turning point? (1-{count}, q to quit): ").strip().lower()
        if raw in ("q", "quit"):
            return None
        if raw.isdigit() and 1 <= int(raw) <= count:
            return int(raw) - 1
        print(f"Enter a number from 1 to {count}.")


def edit_note(state, case):
    key = str(case["id"])
    current = state["notes"].get(key, "")
    if current:
        print("Your current note:", current)
    text = input("Add or replace a note (one line, Enter to skip): ").strip()
    if text:
        state["notes"][key] = text[:NOTE_MAX]
        save_state(state)
        print("Note saved.")


def play(state, case, daily):
    show_case(case)
    picked = ask_line(len(case["lines"]))
    if picked is None:
        print("No answer recorded.")
        return
    correct = record_attempt(state, case, picked, daily)
    print()
    show_result(case, correct)
    edit_note(state, case)


def cmd_today(state):
    day = today_key()
    case = daily_case(day)
    done = state["daily"].get(day)
    if done:
        print(f"Today's case is already finished: {'you found the turning point.' if done['correct'] else 'not this time.'}")
        show_case(case)
        print(f"Your answer was line {done['picked'] + 1}. The turning point is line {case['answer'] + 1}.")
        print()
        print(textwrap.fill(case["explanation"], width()))
        print()
        return
    print(f"Today's challenge ({dt.date.today():%A, %B %d}). Difficulty: {case['difficulty']}")
    play(state, case, daily=True)


def cmd_practice(state, args):
    matches = [
        c for c in CASES
        if (not args.topic or c["topic"] == args.topic)
        and (not args.difficulty or c["difficulty"] == args.difficulty)
        and (not args.severity or c["severity"] == args.severity)
    ]
    if not matches:
        print("No cases match these filters.")
        return
    print(f"{len(matches)} of {len(CASES)} cases")
    for n, c in enumerate(matches, 1):
        solved = state["results"].get(str(c["id"]), {}).get("correct", 0) > 0
        status = "Solved" if solved else "Not yet"
        print(f"{n:>3}. {c['title']:<24} {c['topic']:<20} {c['difficulty']:<7} {c['severity']:<9} {status}")
    choice = input("Play which number? (Enter to exit): ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(matches):
        play(state, matches[int(choice) - 1], daily=False)


def cmd_progress(state):
    s = get_stats(state)
    print("Progress (saved on this computer)")
    print(f"  Cases solved:   {s['solved']} / {len(CASES)}")
    print(f"  Accuracy:       {s['accuracy']}%")
    print(f"  Current streak: {s['streak']}")
    print(f"  Best streak:    {s['bestStreak']}")
    print()
    print("Badges")
    for name, desc, earned in BADGES:
        print(f"  [{'x' if earned(s) else ' '}] {name}: {desc}")


def cmd_notes(state, args):
    with_notes = [c for c in CASES if state["notes"].get(str(c["id"]), "").strip()]
    if args.export:
        out = Path(args.export)
        if out.exists() and not args.force:
            print(f"{out} already exists. Use --force to replace it.", file=sys.stderr)
            return 1
        parts = [f"{c['title']}\n{'-' * len(c['title'])}\n{state['notes'][str(c['id'])].strip()}\n" for c in with_notes]
        out.write_text("LogHunt notes\n\n" + "\n".join(parts), encoding="utf-8")
        print(f"Saved {len(with_notes)} note(s) to {out.resolve()}")
        return 0
    if not with_notes:
        print("No notes yet. Add one after playing a case.")
        return 0
    for c in with_notes:
        print(f"{c['title']}\n  {state['notes'][str(c['id'])]}\n")
    return 0


def cmd_friends(state):
    s = get_stats(state)
    rows = FRIENDS + [{"name": "You", "solved": s["solved"], "bestStreak": s["bestStreak"], "me": True}]
    rows.sort(key=lambda p: p["solved"] * 10 + p["bestStreak"] * 5, reverse=True)
    print("Friends leaderboard (demo: sample names and scores, not real people)")
    print(f"{'#':>3}  {'Player':<12} {'Solved':>6} {'Best streak':>11} {'Score':>6}")
    for i, p in enumerate(rows, 1):
        mark = "  <- you" if p.get("me") else ""
        score = p["solved"] * 10 + p["bestStreak"] * 5
        print(f"{i:>3}  {p['name']:<12} {p['solved']:>6} {p['bestStreak']:>11} {score:>6}{mark}")
    print("Score = solved x 10 + best streak x 5.")


def cmd_team(state):
    s = get_stats(state)
    total = min(TEAM["goal"], sum(m["solved"] for m in TEAM["members"]) + s["solved"])
    print(f"{TEAM['name']} (demo): {total} of {TEAM['goal']} cases solved")
    filled = round(total / TEAM["goal"] * 20)
    print(f"[{'#' * filled}{'-' * (20 - filled)}]")
    for m in TEAM["members"] + [{"name": "You", "solved": s["solved"]}]:
        print(f"  {m['name']}: {m['solved']} solved")


# ---------- entry point ----------

def build_parser():
    parser = argparse.ArgumentParser(description="LogHunt: read simulated logs and find the turning point.")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("today", help="play today's case")
    practice = sub.add_parser("practice", help="replay any case, with optional filters")
    practice.add_argument("--topic", choices=TOPICS)
    practice.add_argument("--difficulty", choices=DIFFICULTIES)
    practice.add_argument("--severity", choices=SEVERITIES)
    sub.add_parser("progress", help="show stats and badges")
    notes = sub.add_parser("notes", help="show or export your notes")
    notes.add_argument("--export", metavar="FILE", help="write notes to a text file")
    notes.add_argument("--force", action="store_true", help="replace the export file if it exists")
    sub.add_parser("friends", help="demo leaderboard")
    sub.add_parser("team", help="demo team challenge")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    state = load_state()
    command = args.command or "today"
    try:
        if command == "today":
            cmd_today(state)
        elif command == "practice":
            cmd_practice(state, args)
        elif command == "progress":
            cmd_progress(state)
        elif command == "notes":
            return cmd_notes(state, args)
        elif command == "friends":
            cmd_friends(state)
        elif command == "team":
            cmd_team(state)
    except (EOFError, KeyboardInterrupt):
        print("\nBye.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
