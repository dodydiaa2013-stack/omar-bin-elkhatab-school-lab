# Reference-only files

This folder is reserved for source files shared for review and reference only.

- Files here are not part of the website build or deployment.
- Do not merge or copy this folder into the production website repository.
- The live Google Apps Script project is separate; adding or deleting files here does not change it.
- `code.gs` is a **redacted review copy**, not a deployable replacement. Its administrator and recovery email values are placeholders. Restore the verified values only in the actual Apps Script project after reviewing the changes.
- No passwords, OAuth secrets, GitHub tokens, or private keys should be stored here.

## Changes in the review copy

- Accepts either the normal `{ changes: [...] }` payload, a direct array, or a nested JSON string for compatibility.
- Merges partial text updates with the latest saved changes while holding the script lock, preventing concurrent partial saves from overwriting each other.
- Supports explicit full-snapshot replacement through `replaceAll=true`, which the website editor now sends.
- Keeps the existing non-empty-save requirement and Drive/GitHub verification flow.

These files are not technically read-only in GitHub: repository contributors with write access may edit or delete them. The restriction is procedural: treat them as reference material only.
