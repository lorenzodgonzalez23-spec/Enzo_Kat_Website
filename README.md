# Enzo & Kat Wedding Website

Static wedding website for Enzo and Kat, published with GitHub Pages.

## RSVP submissions

The RSVP form stores submissions in Supabase. Each row contains the respondent's name, attendance response, additional guest names, and a server-generated submission time. The respondent is not counted among the additional guests; up to six additional guests can be listed.

### Configure Supabase

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. From the repository root, link the project and apply the database migration:

   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. Configure the Edge Function to accept requests from the deployed site origin. For local testing, add the local origin as a comma-separated value:

   ```sh
   supabase secrets set ALLOWED_ORIGINS=https://lorenzodgonzalez23-spec.github.io
   ```

   The Supabase URL and service-role key are available to the Edge Function as Supabase-managed environment variables. Never put the service-role key in the website or commit it to the repository.

4. Deploy the submission function:

   ```sh
   supabase functions deploy submit-rsvp
   ```

5. In `rsvp-config.js`, replace `YOUR_PROJECT_REF` with the project reference and `YOUR_SUPABASE_PUBLISHABLE_KEY` with the project's publishable (or legacy anon) key. The publishable key is public; database row-level security and the Edge Function keep submissions private.
6. Publish the updated website. The RSVP form reports that it is unavailable until this configuration and deployment are complete.

Submissions can be reviewed by project owners in the Supabase dashboard. The public website has no read access to RSVP records.

### Validate the Edge Function

With Deno installed, run:

```sh
deno test supabase/functions/submit-rsvp/validation_test.ts
```
