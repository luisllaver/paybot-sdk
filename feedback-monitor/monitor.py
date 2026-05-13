#!/usr/bin/env python3
"""
Moltbook Feedback Monitor
Fetches synkra's posts and comments from the Moltbook API,
stores them in a local SQLite database, and extracts insights.

Uses only Python stdlib — no pip dependencies.
"""

import json
import logging
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "feedback.db")
LOG_PATH = os.path.join(SCRIPT_DIR, "monitor.log")
CREDENTIALS_PATH = "/root/.config/moltbook/credentials.json"
STATE_PATH = "/root/.config/moltbook/paybot-loop-state.json"

API_BASE = "https://www.moltbook.com/api/v1"
COMMENTS_PAGE_SIZE = 50  # request up to 50 comments per page

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("feedback-monitor")

# ---------------------------------------------------------------------------
# Topic / Sentiment classification (keyword-based, no ML)
# ---------------------------------------------------------------------------

TOPIC_KEYWORDS = {
    "trust_levels": [
        "trust", "trust level", "reputation", "verified", "verification",
        "trustworthy", "credibility", "identity", "kyc", "sybil",
    ],
    "chain_choice": [
        "chain", "blockchain", "ethereum", "solana", "base", "polygon",
        "l1", "l2", "layer", "rollup", "evm", "gas fee", "network",
    ],
    "self_hosting": [
        "self-host", "self host", "selfhost", "docker", "deploy",
        "on-prem", "local", "server", "infrastructure", "hosting",
    ],
    "use_cases": [
        "use case", "usecase", "scenario", "workflow", "integration",
        "how to", "example", "demo", "tutorial", "real world",
    ],
    "x402_protocol": [
        "x402", "402", "http 402", "payment required", "pay-per",
        "micropayment", "paywall", "protocol", "header", "standard",
    ],
    "earning_side": [
        "earn", "earning", "revenue", "monetize", "income", "payout",
        "compensation", "reward", "incentive", "profit", "money",
    ],
}

POSITIVE_WORDS = [
    "great", "love", "awesome", "excellent", "amazing", "good", "nice",
    "brilliant", "fantastic", "helpful", "useful", "perfect", "thanks",
    "thank you", "excited", "impressive", "solid", "well done", "agree",
    "strongly agree", "support", "fan of", "like this",
]

NEGATIVE_WORDS = [
    "bad", "terrible", "awful", "hate", "sucks", "broken", "useless",
    "annoying", "frustrated", "disappointing", "worst", "fail", "ugly",
    "concern", "worried", "disagree", "not good", "don't like", "won't use",
    "scam", "spam", "waste",
]

QUESTION_MARKERS = ["?", "how do", "how can", "what is", "what are", "is there",
                     "can i", "can we", "does it", "will it", "any way to",
                     "wondering", "question"]

FEATURE_REQUEST_MARKERS = [
    "would be nice", "would love", "should add", "please add", "feature request",
    "wish there was", "it would help", "can you add", "could you add",
    "suggestion:", "idea:", "proposal:", "missing feature", "need support for",
    "want to see", "looking for", "we need", "i need", "hoping for",
]

PAIN_POINT_MARKERS = [
    "problem", "issue", "bug", "struggle", "difficult", "hard to",
    "confusing", "unclear", "pain", "frustrating", "doesn't work",
    "can't figure", "error", "crash", "broken", "complicated",
    "too slow", "not intuitive", "no documentation", "missing",
]


def classify_topic(text: str) -> str:
    """Return the best-matching topic category or 'general'."""
    text_lower = text.lower()
    scores = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[topic] = score
    if not scores:
        return "general"
    return max(scores, key=scores.get)


def classify_sentiment(text: str) -> str:
    text_lower = text.lower()
    pos = sum(1 for w in POSITIVE_WORDS if w in text_lower)
    neg = sum(1 for w in NEGATIVE_WORDS if w in text_lower)
    is_question = any(m in text_lower for m in QUESTION_MARKERS)
    if is_question and pos == 0 and neg == 0:
        return "question"
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    if is_question:
        return "question"
    return "neutral"


def extract_feature_request(text: str) -> str:
    text_lower = text.lower()
    for marker in FEATURE_REQUEST_MARKERS:
        idx = text_lower.find(marker)
        if idx != -1:
            # grab the sentence containing the marker
            start = max(0, text_lower.rfind(".", 0, idx) + 1)
            end = text_lower.find(".", idx)
            if end == -1:
                end = min(len(text), idx + 200)
            snippet = text[start:end].strip()
            return snippet[:500]
    return ""


def extract_pain_point(text: str) -> str:
    text_lower = text.lower()
    for marker in PAIN_POINT_MARKERS:
        idx = text_lower.find(marker)
        if idx != -1:
            start = max(0, text_lower.rfind(".", 0, idx) + 1)
            end = text_lower.find(".", idx)
            if end == -1:
                end = min(len(text), idx + 200)
            snippet = text[start:end].strip()
            return snippet[:500]
    return ""


def extract_suggestion(text: str) -> str:
    """Pull out an actionable suggestion if present."""
    text_lower = text.lower()
    suggestion_markers = [
        "you could", "you should", "try to", "consider", "maybe",
        "what if", "how about", "i suggest", "my suggestion",
        "recommendation", "alternatively",
    ]
    for marker in suggestion_markers:
        idx = text_lower.find(marker)
        if idx != -1:
            start = max(0, text_lower.rfind(".", 0, idx) + 1)
            end = text_lower.find(".", idx)
            if end == -1:
                end = min(len(text), idx + 200)
            snippet = text[start:end].strip()
            return snippet[:500]
    return ""


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def load_credentials() -> dict:
    with open(CREDENTIALS_PATH) as f:
        data = json.load(f)
    # credentials.json may be keyed by agent name: {"synkra": {...}, "hermes-gateway": {...}}
    # Normalize to flat {"api_key": ..., "agent_name": ...}
    if "api_key" not in data:
        entry = data.get("synkra", next(iter(data.values())))
        return {"api_key": entry["api_key"], "agent_name": "synkra"}
    return data


def load_state() -> dict:
    if not os.path.exists(STATE_PATH):
        return {"posted_ids": []}
    with open(STATE_PATH) as f:
        return json.load(f)


def api_get(path: str, api_key: str, params: dict | None = None) -> dict | list | None:
    """Make a GET request to the Moltbook API. Returns parsed JSON or None on error."""
    url = f"{API_BASE}{path}"
    if params:
        qs = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items() if v is not None)
        if qs:
            url = f"{url}?{qs}"

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "synkra-feedback-monitor/1.0")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        log.error("HTTP %d on %s: %s", e.code, url, body[:300])
        return None
    except Exception as e:
        log.error("Request failed for %s: %s", url, e)
        return None


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        log.error("Database not found at %s — run setup-db.sh first", DB_PATH)
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def upsert_post(conn: sqlite3.Connection, post: dict) -> None:
    conn.execute(
        """INSERT INTO posts (post_id, title, submolt, content, created_at,
                              upvotes, downvotes, comment_count, is_spam, verification_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(post_id) DO UPDATE SET
               title=excluded.title,
               upvotes=excluded.upvotes,
               downvotes=excluded.downvotes,
               comment_count=excluded.comment_count,
               is_spam=excluded.is_spam,
               verification_status=excluded.verification_status
        """,
        (
            post.get("id", post.get("post_id", "")),
            post.get("title", ""),
            (post["submolt"]["name"] if isinstance(post.get("submolt"), dict) else post.get("submolt", post.get("submolt_name", ""))),
            post.get("content", post.get("body", "")),
            post.get("created_at", post.get("createdAt", "")),
            post.get("upvotes", post.get("upvote_count", 0)),
            post.get("downvotes", post.get("downvote_count", 0)),
            post.get("comment_count", post.get("commentCount", 0)),
            1 if post.get("is_spam", False) else 0,
            post.get("verification_status", post.get("verificationStatus", "unknown")),
        ),
    )


def upsert_comment(conn: sqlite3.Connection, comment: dict, post_id: str) -> None:
    conn.execute(
        """INSERT INTO comments (comment_id, post_id, author_name, author_karma,
                                 content, upvotes, downvotes, created_at, parent_comment_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(comment_id) DO UPDATE SET
               content=excluded.content,
               upvotes=excluded.upvotes,
               downvotes=excluded.downvotes,
               author_karma=excluded.author_karma
        """,
        tuple(
            json.dumps(v) if isinstance(v, (dict, list)) else v
            for v in (
                comment.get("id", comment.get("comment_id", "")),
                post_id,
                comment.get("author", comment.get("author_name", comment.get("username", ""))),
                comment.get("author_karma", comment.get("karma", 0)),
                comment.get("content", comment.get("body", "")),
                comment.get("upvotes", comment.get("upvote_count", 0)),
                comment.get("downvotes", comment.get("downvote_count", 0)),
                comment.get("created_at", comment.get("createdAt", "")),
                comment.get("parent_comment_id", comment.get("parentId", None)),
            )
        ),
    )


def upsert_insight(conn: sqlite3.Connection, comment_id: str, text: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    topic = classify_topic(text)
    sentiment = classify_sentiment(text)
    feature_req = extract_feature_request(text)
    pain_point = extract_pain_point(text)
    suggestion = extract_suggestion(text)

    conn.execute(
        """INSERT INTO insights (comment_id, topic_category, sentiment,
                                 feature_request, pain_point, suggestion, extracted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT DO NOTHING
        """,
        (comment_id, topic, sentiment, feature_req, pain_point, suggestion, now),
    )
    # We allow multiple insights per comment if re-run — but avoid exact dupes
    # by relying on the unique combo. Since there is no unique constraint on
    # (comment_id) alone, we delete+reinsert to keep idempotent.
    conn.execute("DELETE FROM insights WHERE comment_id = ?", (comment_id,))
    conn.execute(
        """INSERT INTO insights (comment_id, topic_category, sentiment,
                                 feature_request, pain_point, suggestion, extracted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (comment_id, topic, sentiment, feature_req, pain_point, suggestion, now),
    )


def upsert_voter(conn: sqlite3.Connection, post_id: str, voter: dict) -> None:
    conn.execute(
        """INSERT INTO voters (post_id, voter_name, vote_type, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(post_id, voter_name, vote_type) DO NOTHING
        """,
        (
            post_id,
            voter.get("username", voter.get("voter_name", "")),
            voter.get("vote_type", voter.get("type", "upvote")),
            voter.get("created_at", voter.get("createdAt", "")),
        ),
    )


# ---------------------------------------------------------------------------
# Fetch logic
# ---------------------------------------------------------------------------

def fetch_user_posts(api_key: str, agent_name: str) -> list[dict]:
    """Fetch all posts by the agent. Tries user posts endpoint and falls back to known IDs."""
    posts = []

    # Try the user posts endpoint
    data = api_get(f"/users/{agent_name}/posts", api_key)
    if isinstance(data, list):
        posts = data
    elif isinstance(data, dict):
        posts = data.get("posts", data.get("data", data.get("results", [])))

    # Also try fetching individual posts from the state file
    state = load_state()
    known_ids = set(state.get("posted_ids", []))
    fetched_ids = {p.get("id", p.get("post_id", "")) for p in posts}
    missing_ids = known_ids - fetched_ids

    for pid in missing_ids:
        post_data = api_get(f"/posts/{pid}", api_key)
        if post_data and isinstance(post_data, dict):
            # Might be nested: {"post": {...}} or direct
            post_obj = post_data.get("post", post_data)
            if post_obj.get("id") or post_obj.get("post_id"):
                posts.append(post_obj)

    log.info("Fetched %d posts for %s", len(posts), agent_name)
    return posts


def fetch_comments(api_key: str, post_id: str) -> list[dict]:
    """Fetch all comments for a post, handling pagination."""
    all_comments = []
    page = 1

    while True:
        data = api_get(f"/posts/{post_id}/comments", api_key, {
            "page": page,
            "limit": COMMENTS_PAGE_SIZE,
            "per_page": COMMENTS_PAGE_SIZE,
        })

        if data is None:
            break

        if isinstance(data, list):
            comments = data
        elif isinstance(data, dict):
            comments = data.get("comments", data.get("data", data.get("results", [])))
        else:
            break

        if not comments:
            break

        all_comments.extend(comments)

        # If we got fewer than requested, we've reached the last page
        if len(comments) < COMMENTS_PAGE_SIZE:
            break

        page += 1

    return all_comments


def fetch_voters(api_key: str, post_id: str) -> list[dict]:
    """Fetch voters for a post (best-effort, endpoint may not exist)."""
    data = api_get(f"/posts/{post_id}/votes", api_key)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("votes", data.get("data", []))
    return []


# ---------------------------------------------------------------------------
# Summary report
# ---------------------------------------------------------------------------

def print_summary(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()

    post_count = cur.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    comment_count = cur.execute("SELECT COUNT(*) FROM comments").fetchone()[0]
    insight_count = cur.execute("SELECT COUNT(*) FROM insights").fetchone()[0]
    voter_count = cur.execute("SELECT COUNT(*) FROM voters").fetchone()[0]

    print("\n" + "=" * 60)
    print("  FEEDBACK MONITOR SUMMARY")
    print("=" * 60)
    print(f"  Posts tracked:    {post_count}")
    print(f"  Comments stored:  {comment_count}")
    print(f"  Insights derived: {insight_count}")
    print(f"  Voters recorded:  {voter_count}")

    # Topic distribution
    print("\n  --- Topic Distribution ---")
    rows = cur.execute(
        "SELECT topic_category, COUNT(*) as cnt FROM insights GROUP BY topic_category ORDER BY cnt DESC"
    ).fetchall()
    for topic, cnt in rows:
        print(f"    {topic:<20s} {cnt:>4d}")

    # Sentiment distribution
    print("\n  --- Sentiment Distribution ---")
    rows = cur.execute(
        "SELECT sentiment, COUNT(*) as cnt FROM insights GROUP BY sentiment ORDER BY cnt DESC"
    ).fetchall()
    for sentiment, cnt in rows:
        print(f"    {sentiment:<20s} {cnt:>4d}")

    # Feature requests
    print("\n  --- Feature Requests (latest 5) ---")
    rows = cur.execute(
        "SELECT feature_request FROM insights WHERE feature_request != '' ORDER BY extracted_at DESC LIMIT 5"
    ).fetchall()
    if rows:
        for (fr,) in rows:
            print(f"    - {fr[:100]}")
    else:
        print("    (none detected)")

    # Pain points
    print("\n  --- Pain Points (latest 5) ---")
    rows = cur.execute(
        "SELECT pain_point FROM insights WHERE pain_point != '' ORDER BY extracted_at DESC LIMIT 5"
    ).fetchall()
    if rows:
        for (pp,) in rows:
            print(f"    - {pp[:100]}")
    else:
        print("    (none detected)")

    # Top commenters
    print("\n  --- Top Commenters ---")
    rows = cur.execute(
        """SELECT author_name, COUNT(*) as cnt, MAX(author_karma) as karma
           FROM comments WHERE author_name != ''
           GROUP BY author_name ORDER BY cnt DESC LIMIT 5"""
    ).fetchall()
    for name, cnt, karma in rows:
        print(f"    {name:<20s} {cnt:>3d} comments  (karma: {karma})")

    print("\n" + "=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("Feedback monitor starting")

    creds = load_credentials()
    api_key = creds["api_key"]
    agent_name = creds.get("agent_name", "synkra")

    conn = get_db()

    try:
        # 1. Fetch posts
        posts = fetch_user_posts(api_key, agent_name)
        if not posts:
            log.warning("No posts found for %s", agent_name)

        for post in posts:
            post_id = post.get("id", post.get("post_id", ""))
            if not post_id:
                continue

            log.info("Processing post %s: %s", post_id, post.get("title", "")[:60])
            upsert_post(conn, post)

            # 2. Fetch comments
            comments = fetch_comments(api_key, post_id)
            log.info("  Found %d comments", len(comments))

            for comment in comments:
                comment_id = comment.get("id", comment.get("comment_id", ""))
                if not comment_id:
                    continue

                upsert_comment(conn, comment, post_id)

                # 3. Extract insights
                text = comment.get("content", comment.get("body", ""))
                if text:
                    upsert_insight(conn, comment_id, text)

            # 4. Fetch voters (best-effort)
            voters = fetch_voters(api_key, post_id)
            log.info("  Found %d voters", len(voters))
            for voter in voters:
                upsert_voter(conn, post_id, voter)

            conn.commit()

        # 5. Summary
        print_summary(conn)

        log.info("Feedback monitor completed successfully")

    except Exception:
        log.exception("Feedback monitor failed")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
