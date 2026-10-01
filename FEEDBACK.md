# Player feedback

The Feedback button (top right in the game) posts each note to a Google Form owned by the developer.
No keys live in this public code: a Google Form accepts anonymous submissions by design.

- Each note has an id (`fb-...`), the player's name, a type (bug, idea, other or comment), the message,
  `replyTo` (the note a comment belongs to) and game info (version, device, floor, prestige).
- Responses collect in the form's linked Google Sheet, "Deep Dig Heroes Feedback (Responses)"
  (Drive id `1iMAeYRIlCvNHLXJK84SA_3g0NBLVMDtzUJwaQ1sr1ww`).
- Replies go in `feedback/replies.json`, keyed by note id, and show up in that player's "Your feedback" list:

```json
{ "fb-abc123-x1y2": [{ "from": "Braeton", "text": "Fixed in v1.9.1", "at": "2026-10-02T15:04:00Z" }] }
```

Syncing (ask Claude to "do the notes"): read the sheet, open a GitHub issue per new note labeled with
the player's name, add comments for follow-ups, and copy replies into `feedback/replies.json`.

The form's `formResponse` URL and entry ids are in `FEEDBACK_FORM` in `js/feedback.js`. The form must stay
published to "Anyone with the link", without sign-in or email collection, or the game's notes are refused.
