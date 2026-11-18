# Reference-only files and lab backend setup

These files are source templates for the **public GitHub Pages lab only**. They are not the live production Apps Script project and must never be copied into the production deployment without a separate review.

## Lab isolation

The lab Apps Script template uses separate Drive folder names, a separate page-text JSON filename, separate Script Properties, and the lab GitHub repository:

- Drive folders are prefixed with `مختبر -`.
- Page text file: `page-changes-lab.json`.
- GitHub repository: `dodydiaa2013-stack/omar-bin-elkhatab-school-lab`.
- GitHub input branch: `automation/lab-page-text-sync-input`.
- The lab HTML still has its backend URL deliberately disabled until the lab Apps Script Web App is deployed and its URL is inserted into the lab site.

## Two-way page-text synchronization

The lab backend template supports guarded two-way synchronization:

1. Website save -> lab Google Drive -> lab GitHub input branch -> lab workflow updates the lab website.
2. Direct edit to `page-changes-lab.json` on the lab input branch -> next page-text request reads GitHub and imports the change into lab Drive.
3. A SHA-256 content baseline is stored in Script Properties. If only one side changed, that side is synchronized. If both sides changed independently, the backend does not overwrite either copy and logs a conflict.
4. The production repository, production input branch, and production JSON filename are not used by this lab template.

## Before deploying the lab Apps Script

Create a **new, separate Apps Script project** and use the complete `code.gs` template after filling only these identity placeholders in that new project:

- `REPLACE_WITH_LAB_GOOGLE_OAUTH_CLIENT_ID`
- `REPLACE_WITH_LAB_ADMIN_EMAIL`
- `REPLACE_WITH_LAB_RECOVERY_EMAIL`

Do not put the real values in this public repository.

Configure these Script Properties in the new lab Apps Script project:

| Property | Value |
|---|---|
| `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT` | Lab-only admin password verifier values, generated using the existing recovery/setup process |
| `GITHUB_LAB_PAGE_SYNC_TOKEN` | A narrowly scoped GitHub token with Contents read/write access to this lab repository |
| `GITHUB_LAB_PAGE_SYNC_BRANCH` | `automation/lab-page-text-sync-input` |
| `ADMIN_AUTH_VERSION` | `1` |

The first lab request creates the lab page-text folder/file. Other image, schedule, and album folders are created/used under the lab-prefixed names. Ensure the lab Google account has its own test data; do not point these functions at production folders or file IDs.

The OAuth client must be configured for the GitHub Pages origin `https://dodydiaa2013-stack.github.io`. The Web App deployment must be separate from production and grant the required access for the site's JSONP/form-post flow.

After deploying the lab Web App, update the lab `index.html` backend URL in all backend call sites with that new Web App URL. Do not use the production Apps Script URL.

## Files

- `code.gs`: isolated lab backend template; placeholders remain intentionally unfilled.
- `code-before-text-fixes.gs`: original review snapshot retained for comparison.

No passwords, OAuth client secrets, GitHub tokens, or private keys belong in this repository.
