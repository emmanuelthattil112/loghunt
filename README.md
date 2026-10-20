# LogHunt

[![CI](https://github.com/emmanuelthattil112/loghunt/actions/workflows/ci.yml/badge.svg)](https://github.com/emmanuelthattil112/loghunt/actions/workflows/ci.yml)

A daily cybersecurity puzzle. Read simulated Windows-style logs and find the line that shows the attack.

## How to play

1. Pick today's case, or any case in Practice. You can also generate a new random case.
2. Read the log. Use the search box, the event-source filter, or the timeline to narrow it down.
3. Tap the line that shows the turning point.
4. Submit your answer.
5. Read the explanation and the analyst walkthrough, then optionally write a detection rule for a bonus.

## Features

- **Daily streak:** finish today's case to keep your streak going.
- **12 daily cases** covering identity, malware, persistence, lateral movement, credential access, exfiltration, ransomware, web attacks, and more.
- **Endless practice:** generate new random cases from attack patterns.
- **MITRE ATT&CK:** every case is tagged with its technique, with a link to the ATT&CK page.
- **Log explorer:** search the log, filter by event source, and see events per minute on a timeline.
- **Hints:** reveal a hint for 25 points.
- **Points and detection rules:** solving a case earns 100 points (75 with a hint). Write a detection rule that catches the attack for 25 more.
- **Share card:** copy a card showing your last 7 days and streak. It never reveals the answers.
- **Classroom:** teachers pick cases and share a code. Students paste the code to get the assignment. Print a worksheet with an answer key.
- **Community cases:** anyone can add a case by pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).
- **Install and play offline:** add LogHunt to your home screen from a phone or computer browser.
- **Progress and badges, notes, and downloadable notes.**
- **Friends leaderboard (demo)** and **team challenge (demo)**. The names and numbers are sample data.

## Data

All logs are simulated for training. No real systems or people are involved. Attack names come from the public MITRE ATT&CK framework.

## Saving progress

Progress (streak, points, notes, classroom assignments) is saved in the browser you use. It is not synced between devices yet.

## Run it locally

Open `index.html` in any web browser.

To play in the terminal instead, use the Python version (Python 3.8 or newer, no packages needed):

```bash
python3 python/loghunt.py
```

It has the same cases and rules, and it saves progress separately from the browser version.

## Run the tests

```bash
npm install
npx playwright install chromium
npm test
```

## Versions

- **Main site (`index.html`):** the redesigned LogHunt with Today, Practice, Friends and Progress. It has the theory step, the log explorer, hints, the streak tracker, classroom codes and endless practice.
- **Preview (`preview/index.html`):** the earlier full version, kept for comparison.

## Live site

**https://emmanuelthattil112.github.io/loghunt/**

Preview with all the extra features: https://emmanuelthattil112.github.io/loghunt/preview/
