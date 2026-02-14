# AirFuture Automation Workflow

## 1. Daily Content Generation Cycle (08:00 AM)
1.  **Trigger**: Cron job triggers the generation script.
2.  **Fetch Context**:
    *   Get current date/season.
    *   Fetch daily trends (if enabled).
    *   Retrieve active campaign specs from `01_specs`.
    *   Retrieve AirFuture-kun character profile.
3.  **Generate Drafts (Gemini)**:
    *   Send context + character profile to Gemini API.
    *   Request 3-5 draft posts based on the daily theme (e.g., S1: Empathy, S2: Education).
4.  **Review & Save**:
    *   Parse JSON response.
    *   Validate against NG words and character rules.
    *   Save valid drafts to `posts` table with status `draft_ai`.

## 2. Posting Cycle (Every 30-60 mins)
1.  **Trigger**: Cron job triggers the posting script.
2.  **Check Schedule**:
    *   Query `posts` table for items with `status = scheduled` and `scheduled_at <= now()`.
3.  **Execute Post**:
    *   **If API**: Call `POST /2/tweets`.
    *   **If Puppeteer**: Launch headless browser, login, post.
4.  **Update Status**:
    *   Success: Update status to `posted`, save `posted_at` and `post_id`.
    *   Failure: Update status to `failed`, save `error_message`.
5.  **Log**: Write entry to `logs` table.

## 3. Weekly Analysis Cycle (Sunday 23:00)
1.  **Trigger**: Cron job.
2.  **Aggregate Data**:
    *   Fetch engagement metrics for the week's posts.
    *   Calculate CTR, Engagement Rate.
3.  **Generate Report (Gemini)**:
    *   Send metrics to Gemini.
    *   Ask for "Weekly Summary" and "Improvement Points" for next week.
4.  **Save Report**: Save summary to `05_logs_summary/weekly_report_YYYY-MM-DD.md`.
