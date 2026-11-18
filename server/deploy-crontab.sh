#!/bin/bash
# Deploy server/crontab to database:~/crontab/nanodb.cron through bootstrap's
# deploy_crontab_scope helper (installed to ~/bin), which refuses a source
# without its owner header, records the basename in the host's
# ~/crontab/.nanodb.manifest, and reaps the old file if the pinned basename
# below ever changes.
#
# The helper globs <dir>/*.cron and this source is a single non-.cron file, so
# it is built into a tmp dir under the pinned basename first -- the same shape
# as nano-community/server/deploy-crontab.sh.
#
# Usage: server/deploy-crontab.sh   (yarn deploy:crontab)

set -euo pipefail

SSH_HOST=database
SCOPE_KEY=nanodb
OUT_BASENAME=nanodb.cron
SOURCE="$(cd "$(dirname "$0")" && pwd)/crontab"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

base crontab build "$SOURCE" > "$TMPDIR/$OUT_BASENAME"

REMOTE_TMP=$(ssh -A "$SSH_HOST" 'mktemp -d')
scp -q "$TMPDIR/$OUT_BASENAME" "$SSH_HOST":"$REMOTE_TMP/"
ssh -A "$SSH_HOST" "\$HOME/bin/deploy_crontab_scope '$SCOPE_KEY' '$REMOTE_TMP' cat && rm -rf '$REMOTE_TMP' && \$HOME/bin/load_crontab_files"

echo "Deployed $SOURCE to $SSH_HOST:~/crontab/$OUT_BASENAME (scope=$SCOPE_KEY)"
