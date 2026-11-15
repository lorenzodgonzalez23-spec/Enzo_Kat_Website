# Enzo & Kat Wedding Website

## Website and deployment


The wedding website is a static site: its HTML, styles, scripts, and assets are served directly from the repository. It has no frontend build step or application server. GitHub Pages publishes the repository root from the `main` branch.


- Live site: https://lorenzodgonzalez23-spec.github.io/Enzo_Kat_Website/
- RSVP form and client-side submission code: `index.html`
- Supabase endpoint and public key configuration: `rsvp-config.js`


Merging a site change into `main` updates the GitHub Pages source; the live site reflects it after Pages finishes publishing.


## RSVP services and data flow


The RSVP form sends submissions from the visitor’s browser to the Supabase Edge Function `submit-rsvp`. The function validates the request and inserts it into the Supabase Postgres table `public.rsvp_submissions`.


```text
Visitor's browser
    -> GitHub Pages static site
    -> Supabase Edge Function: submit-rsvp
    -> Supabase Postgres: public.rsvp_submissions
```


The configured Supabase project reference is `pikqsgfoygvycghlfeii`.


The form supports accepting or declining. For an acceptance, the respondent can list up to six additional guests; the respondent is not included in that count. Declines must have zero additional guests. The database derives `additional_guest_count` from the saved guest-name array rather than trusting a client-supplied count.


Each row contains:




































| Column | Description |
| --- | --- |
| `id` | Generated row identifier |
| `respondent_name` | Respondent’s name |
| `attendance` | `accepts` or `declines` |
| `additional_guest_names` | Names of additional guests |
| `additional_guest_count` | Generated count of additional guests |
| `submitted_at` | Database-generated submission time |



## Security and access


`rsvp-config.js` contains the Supabase function URL and a **public** publishable key (or legacy anon key). That key is expected to be visible to website visitors. Never put the Supabase service-role key in the website or commit it to the repository.


The database has row-level security enabled, and direct table access is revoked for the public `anon` and `authenticated` roles. The Edge Function uses Supabase’s server-side service-role key to insert rows. The website has no public endpoint for reading RSVP submissions; project owners can review them in the Supabase dashboard.


The function checks the request origin against `ALLOWED_ORIGINS` and validates the content type, request size, names, response, and guest-count limits. **The origin check is a browser CORS safeguard, not authentication**: the function is publicly reachable, and this setup does not currently include CAPTCHA or rate limiting. Project owners should monitor submissions for spam.


## Supabase setup and deployment


Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then link the project and apply migrations to the remote database:


```sh
supabase login
supabase link --project-ref pikqsgfoygvycghlfeii
supabase db push --remote
```


Set the allowed website origin and deploy the Edge Function:


```sh
supabase secrets set --project-ref pikqsgfoygvycghlfeii ALLOWED_ORIGINS=https://lorenzodgonzalez23-spec.github.io
supabase functions deploy submit-rsvp --project-ref pikqsgfoygvycghlfeii
```


`ALLOWED_ORIGINS` takes origins only—no path or trailing slash. For local RSVP testing, add the local server origin as a comma-separated value. Local testing uses the configured Supabase project and can create real rows, so use clearly labeled test submissions.


The migration is in `supabase/migrations/`; the function and its validation code are in `supabase/functions/submit-rsvp/`. Supabase CLI cache files under `supabase/.temp/` are local and ignored by Git.


## Review and validation


To review saved submissions, open the Supabase project’s **Table Editor** and select `rsvp_submissions`. Or run this in the Supabase SQL Editor:


```sql
select respondent_name, attendance, additional_guest_count,
       additional_guest_names, submitted_at
from public.rsvp_submissions
order by submitted_at desc
limit 20;
```


The Edge Function validation tests can be run with Deno:


```sh
deno test supabase/functions/submit-rsvp/validation_test.ts
deno check supabase/functions/submit-rsvp/index.ts
deno fmt --check supabase/functions/submit-rsvp
```


The function returns HTTP `201` for a stored submission, `400` for invalid input, `403` for a disallowed origin, and `503` if storage is unavailable.

