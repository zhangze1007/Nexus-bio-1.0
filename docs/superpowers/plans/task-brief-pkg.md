# Task Brief: Pin next-auth Version (Task 10)

## Task 10: Remove caret from next-auth
**File:** `package.json` line 37
Change:
```json
"next-auth": "^5.0.0-beta.31",
```
To:
```json
"next-auth": "5.0.0-beta.31",
```
Remove the `^` caret to pin the exact version.

## Constraints
- Do NOT change any other dependencies
- Do NOT run npm install (just edit the file)
