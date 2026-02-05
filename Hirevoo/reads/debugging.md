This error `PGRST205` means that your code is trying to query or insert data into a table named `campaign_emails`, but the database (PostgREST) cannot find it in its schema cache.

**Likely Causes:**
1.  **Typo**: The table might actually be named something else (e.g., `campaign_contacts` as the hint suggests, or `emails`).
2.  **Missing Table**: The table `campaign_emails` was never created in the database.
3.  **Schema Cache**: The table exists, but PostgREST hasn't refreshed its cache (less likely if it's a new table).
4.  **Permissions**: The role used by the worker doesn't have permissions to see the table.

**How to Solve:**
I will search your codebase to see where `campaign_emails` is being used and compare it with your known schema. If it's a typo, I'll correct the code. If the table is missing, we'll need to create it.
