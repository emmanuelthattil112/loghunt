# Contributing to LogHunt

You can add a case to LogHunt by sending a pull request. Each case is one JSON file in `community/cases/`.

## Steps

1. Copy `community/cases/_template.json` to `community/cases/c-your-case-name.json`. The file name must match the `id`.
2. Fill in the fields (see below). The log lines must be simulated. Do not use real hostnames, users, IP addresses from your own network, or anything from a real incident.
3. Run the checks:

   ```bash
   npm install
   npm run community:build   # validates your file and updates community/cases/index.json
   npm test                  # runs the game tests
   ```

4. Commit your case file **and** the updated `community/cases/index.json`, then open a pull request.

CI runs `npm run community:check`. It fails if your file is invalid or if `index.json` was not rebuilt.

## Fields

| Field | What it is |
| --- | --- |
| `id` | `c-` followed by lowercase letters, digits and hyphens, 3 to 40 characters |
| `title` | Up to 60 characters |
| `topic` | One of the existing topics in the game, such as `Malware`, `Identity` or `Web` |
| `difficulty` | `Easy`, `Medium` or `Hard` |
| `severity` | `Low`, `Medium`, `High` or `Critical` |
| `scenario` | What the player is asked to look for, up to 400 characters |
| `lines` | 4 to 30 log lines, each starting with `HH:MM:SS` and at most 300 characters |
| `answer` | Zero-based position of the turning-point line (line 1 is `0`) |
| `explanation` | Why that line matters, up to 500 characters |
| `hint` | A nudge that does not give the answer away, up to 200 characters |
| `attack` | A MITRE ATT&CK technique ID such as `T1110.003` |
| `attackName` | The technique name, up to 80 characters |
| `walkthrough` | 2 to 5 short analyst steps |

## Guidelines

- Make the turning point findable by careful reading, not by guessing.
- Include some believable noise lines that look suspicious but are not the answer.
- Write the explanation and walkthrough for a beginner who is learning.
- Keep it defensive: explain how to detect and contain the activity, not how to carry it out better.
