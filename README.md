# Enzo & Kat Wedding Website

Static wedding website for Enzo and Kat, published with GitHub Pages from the `main` branch.

## RSVP and invitations

Guests receive a unique invitation link. The code is kept in the link fragment (`#invite=...`), looked up by a Supabase Edge Function, and never stored in the invitation table as plaintext. The frontend shows the RSVP section only for a link containing a code:

- No code: the RSVP section and navigation link stay hidden.
- Valid code: the invite name and allowed number of additional guests are shown, and the RSVP form is enabled.
- Invalid or revoked code: the RSVP section is shown with disabled fields and a message to contact the couple.
- Supabase unavailable: the form remains disabled and shows a temporary service error, not an invalid-link message.

The additional guest limit is per invitation and excludes the named invitee. It is between zero and six. The Edge Function checks the code and limit on every lookup and submission; client-side visibility is not an access-control boundary.

The backend uses:

- `rsvp_invites`: invite name, SHA-256 code hash, allowed additional guest count, and active status.
- `rsvp_submissions`: one current RSVP per invitation, with `updated_at`.
- `rsvp_submission_history`: private snapshots of initial submissions and changes.

The update is additive: existing RSVP rows are preserved and remain unlinked to invitations. Their `updated_at` is initialized when the migration runs; no earlier update history is available. New invitation-based submissions and subsequent changes are recorded in the history table. Public roles cannot read these tables. Project owners can review invitations, current RSVPs, and RSVP history in the Supabase dashboard.

The couple does not need a custom admin webpage. A local generator prepares the import and invitation-link files; the Supabase Table Editor imports invitation records.

## Prepare and import invitations

Create a UTF-8 CSV with one row per invitation:

```csv
invite_name,max_additional_guests,email
Maria Santos,1,maria@example.com
The Reyes Family,3,
Alex Cruz,0,alex@example.com
```

`email` is optional and is only included in the private links file for the couple's use; it is not stored in the database. Generate the files with Deno:

```sh
deno run --allow-read --allow-write scripts/generate-invites.ts guest-list.csv https://enzoandkat.site/
```

The script writes two files in the current directory and refuses to overwrite existing files:

- `invite-import.csv`: invite details and code hashes, ready to import into `rsvp_invites`.
- `invite-links.private.csv`: the raw invitation links to distribute to guests.

In the Supabase dashboard, select the intended project, open **Table Editor → `rsvp_invites`**, and import `invite-import.csv`. Check the project and column mapping before confirming. The invitation links are bearer credentials: keep `invite-links.private.csv` private, send each link only to its intended guest, and do not commit it. The generated output files are ignored by Git.

If a links file is lost, generate a replacement code and update that invitation's `code_hash` in the dashboard; the old link will no longer work.

## Local staging setup

Use a separate Supabase project for staging and fake invitees only. Free Supabase projects may pause after inactivity; restore the staging project from the dashboard before testing if necessary.

1. Create a staging project in Supabase and note its project reference.
2. From the repository root, link the CLI to staging and apply migrations there:

   ```sh
   supabase login
   supabase link --project-ref <staging-project-ref>
   supabase db push --remote
   ```

3. Allow the local preview origin and deploy both functions:

   ```sh
   supabase secrets set --project-ref <staging-project-ref> ALLOWED_ORIGINS=http://localhost:8000
   supabase functions deploy lookup-rsvp-invite --project-ref <staging-project-ref>
   supabase functions deploy submit-rsvp --project-ref <staging-project-ref>
   ```

   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not put the service-role key in the frontend or generated files.

4. Copy the local config example and set its staging project URL and publishable key. This file is ignored by Git:

   ```powershell
   Copy-Item rsvp-config.local.example.js rsvp-config.local.js
   ```

5. In one terminal, start a local static server:

   ```sh
   python -m http.server 8000
   ```

   In a second terminal, generate test links for that origin:

   ```sh
   deno run --allow-read --allow-write scripts/generate-invites.ts guest-list.csv http://localhost:8000/
   ```

   Import the generated hash-only CSV into the **staging** project's `rsvp_invites` table, then open a link from `invite-links.private.csv`.

The local website loads `rsvp-config.local.js` on `localhost`; GitHub Pages loads the production `rsvp-config.js`. Do not replace the production config with staging values or commit `rsvp-config.local.js`.

## Validation

With Deno installed, run focused tests and type checks:

```sh
deno test scripts/generate-invites_test.ts supabase/functions/_shared/invitations_test.ts supabase/functions/submit-rsvp/validation_test.ts
deno check supabase/functions/lookup-rsvp-invite/index.ts supabase/functions/submit-rsvp/index.ts scripts/generate-invites.ts
deno fmt --check scripts supabase/functions
```

In staging, verify missing-code, valid-code, invalid/revoked-code, guest-limit, first submission, updated RSVP/history, and unavailable-backend states. Simulate a backend outage without pausing the project by using an invalid staging function URL or blocking the request, then confirm the website retains form values and does not show success.

## Production setup

Do not deploy the invitation migration or functions to production until the staging flow has been reviewed and approved. At production cutover:

1. Link the Supabase CLI to the production project, apply the migration, set `ALLOWED_ORIGINS` to `https://enzoandkat.site,https://www.enzoandkat.site`, and deploy both Edge Functions.
2. Generate production invitation files and import the hash-only CSV into the production `rsvp_invites` table.
3. Merge the reviewed frontend/config changes to `main`.
4. Send guests their private invitation links after the live site has updated.

Confirm `rsvp-config.js` contains the production function URLs and public publishable key before merging. Never use staging configuration on the production site. The website is published from `main` at `https://enzoandkat.site/`.
