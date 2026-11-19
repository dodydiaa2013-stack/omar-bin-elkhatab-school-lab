# Reference-only files and lab backend setup

These files are source templates for the **public GitHub Pages lab only**. They are not the live production Apps Script project and must never be copied into the production deployment without a separate review.

## Lab isolation

The lab Apps Script template uses separate Drive folders for images, schedules, and albums. **Page text is the exception: it is stored only in GitHub, not in Google Drive.**

- Image, schedule, and album folders are prefixed with `مختبر -`.
- Page text JSON: `page-changes-lab.json` in the lab repository.
- GitHub repository: `dodydiaa2013-stack/omar-bin-elkhatab-school-lab`.
- GitHub input branch: `automation/lab-page-text-sync-input`.
- The lab HTML backend URL remains deliberately disabled until the separate lab Apps Script Web App is deployed and its URL is inserted into the lab site.

## GitHub-only page-text storage

1. The website requests saved text from the lab Apps Script.
2. Apps Script reads `page-changes-lab.json` directly from the dedicated GitHub input branch.
3. After administrator password and Google verification, saving writes the new JSON directly to that branch.
4. Apps Script re-reads the file and verifies its content before confirming success.
5. After a successful write and read-back verification, the lab Apps Script sends a `repository_dispatch` event to start the sync workflow immediately.
6. The workflow also runs on a five-minute schedule as a safety net, and retains the input-branch push trigger and manual `workflow_dispatch` entry point.
7. The workflow validates the JSON and publishes the matching text into the lab `index.html`.
8. GitHub's file SHA is used for optimistic concurrency. If the file changes between read and write, the save is rejected rather than overwriting the newer change.

For immediate event-driven publishing, deploy the updated `reference-only/code.gs` to the separate lab Apps Script Web App. The scheduled workflow still provides automatic publishing within its next five-minute check if the deployed script has not yet been updated. No extra GitHub token permission is required beyond the lab repository's existing Contents read/write permission.

There is no page-text JSON file, folder, file ID, or text synchronization baseline in Google Drive. Drive remains in use for images, schedules, and albums only.

## Before deploying the lab Apps Script

Create a **new, separate Apps Script project** and use the complete `code.gs` template after filling only these identity placeholders in that new project:

- `REPLACE_WITH_LAB_GOOGLE_OAUTH_CLIENT_ID` in both `reference-only/code.gs` and the single `window.LAB_GOOGLE_OAUTH_CLIENT_ID` setting in `index.html` (use the same lab OAuth client ID in both)
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

The page-text JSON file is kept in the GitHub input branch and is not created in Drive. Other image, schedule, and album folders are created/used under the lab-prefixed names. Ensure the lab Google account has its own test data; do not point these functions at production folders or file IDs.

The OAuth client must be configured for the GitHub Pages origin `https://dodydiaa2013-stack.github.io`. The Web App deployment must be separate from production and grant the required access for the site's JSONP/form-post flow.

After deploying the lab Web App, replace the single `window.LAB_GOOGLE_SCRIPT_URL` value near the top of the lab `index.html` with that new Web App URL. All admin/backend calls use this one setting. Do not use the production Apps Script URL.

The embedded student results, leaders, programming-platform, and student-code frames remain deliberately disconnected in the lab. They are separate Apps Script services in production and must not be pointed at production data. To make those four services functional in the lab, their independent source projects and test datasets must also be cloned and deployed separately.

## Files

- `code.gs`: isolated lab backend template; placeholders remain intentionally unfilled.
- `code-before-text-fixes.gs`: original review snapshot retained for comparison.

No passwords, OAuth client secrets, GitHub tokens, or private keys belong in this repository.
