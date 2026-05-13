#!/usr/bin/env bash
# setup-db.sh — Create/reset the feedback SQLite database
set -euo pipefail

DB_PATH="$(dirname "$0")/feedback.db"

echo "Creating database at ${DB_PATH} ..."

sqlite3 "${DB_PATH}" <<'SQL'
CREATE TABLE IF NOT EXISTS posts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id         TEXT    UNIQUE NOT NULL,
    title           TEXT,
    submolt         TEXT,
    content         TEXT,
    created_at      TEXT,
    upvotes         INTEGER DEFAULT 0,
    downvotes       INTEGER DEFAULT 0,
    comment_count   INTEGER DEFAULT 0,
    is_spam         INTEGER DEFAULT 0,
    verification_status TEXT DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS comments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id        TEXT    UNIQUE NOT NULL,
    post_id           TEXT    NOT NULL,
    author_name       TEXT,
    author_karma      INTEGER DEFAULT 0,
    content           TEXT,
    upvotes           INTEGER DEFAULT 0,
    downvotes         INTEGER DEFAULT 0,
    created_at        TEXT,
    parent_comment_id TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(post_id)
);

CREATE TABLE IF NOT EXISTS insights (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id      TEXT    NOT NULL,
    topic_category  TEXT,
    sentiment       TEXT,
    feature_request TEXT,
    pain_point      TEXT,
    suggestion      TEXT,
    extracted_at    TEXT,
    FOREIGN KEY (comment_id) REFERENCES comments(comment_id)
);

CREATE TABLE IF NOT EXISTS voters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     TEXT    NOT NULL,
    voter_name  TEXT,
    vote_type   TEXT,
    created_at  TEXT,
    UNIQUE(post_id, voter_name, vote_type),
    FOREIGN KEY (post_id) REFERENCES posts(post_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_insights_comment_id ON insights(comment_id);
CREATE INDEX IF NOT EXISTS idx_voters_post_id ON voters(post_id);
SQL

echo "Database ready. Tables: posts, comments, insights, voters"
