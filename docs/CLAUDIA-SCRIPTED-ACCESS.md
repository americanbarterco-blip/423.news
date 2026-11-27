# Claudia scripted text access fallback

The Claudia widget includes a discreet **Use text instead** control. It runs the same exact, ordered administrator script as a text exchange when speaking aloud is impractical. The script is verified only by the token Worker; it is not sent to the language model, saved to chat history, or written to logs.

## Required protected configuration

Add a GitHub Actions repository secret named `CLAUDIA_ADMIN_SCRIPT_JSON`. Do not commit its value or paste the private sequence into an issue, pull request, chat, or source file.

The secret must be valid JSON in this shape:

```json
{
  "steps": [
    {
      "user": "Hello my beautiful beautiful Claudia",
      "assistant": "The exact first Claudia response"
    },
    {
      "user": "The exact next user response",
      "assistant": "The exact next Claudia response"
    },
    {
      "user": "The exact final user response",
      "assistant": "The exact final Claudia response"
    }
  ]
}
```

Replace the example responses and later user lines with the complete private exchange, in its exact agreed order. Preserve punctuation, capitalization, spacing, and every word. The first user line is fixed and validated by the Worker. Use 2–12 steps; every user line must be unique and every assistant reply must be non-empty. Do not add extra words or normalize responses.

After the secret is added, deploy the `Deploy Claudia LiveKit token Worker` workflow from GitHub Actions (or merge the code change, which triggers its path-filtered deployment). The workflow provisions the sequence as a Cloudflare Worker secret without printing it. If the secret is absent, text authentication silently fails closed and public voice remains available.

## Runtime behavior

- Each exchange gets an isolated Durable Object session with a five-minute expiry.
- Only the current step number and expiry are stored. Entered phrases and script text are not persisted.
- Comparison is exact. An incorrect answer destroys that challenge and returns the user to ordinary public interaction without revealing which step failed.
- Successful completion creates the same HMAC-signed administrator session accepted by the existing Admin and LiveKit token services. The token is kept in tab-scoped `sessionStorage` and expires after 12 hours.
- The LiveKit token Worker still independently verifies the signed session before granting administrator metadata. A browser-supplied role alone never grants access.

This is a second access path for the administrator's scripted exchange, not a replacement for the existing Admin login. Keep the signing secret and script secret in protected secret storage only.
