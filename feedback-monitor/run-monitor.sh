#!/usr/bin/env bash
# run-monitor.sh — Cron-compatible wrapper for the feedback monitor
# Add to crontab:  0 */6 * * * /root/paybot-sdk/feedback-monitor/run-monitor.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${SCRIPT_DIR}/feedback.db"
LOG="${SCRIPT_DIR}/monitor.log"

log() {
    echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') [run-monitor] $*" | tee -a "${LOG}"
}

# Ensure database exists
if [ ! -f "${DB_PATH}" ]; then
    log "Database not found, running setup..."
    bash "${SCRIPT_DIR}/setup-db.sh"
fi

log "Starting feedback monitor"
python3 "${SCRIPT_DIR}/monitor.py" 2>&1 | tee -a "${LOG}"
EXIT_CODE=${PIPESTATUS[0]}

if [ ${EXIT_CODE} -eq 0 ]; then
    log "Monitor completed successfully"
else
    log "Monitor exited with code ${EXIT_CODE}"
fi

exit ${EXIT_CODE}
