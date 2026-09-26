#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Purge credential strings from a range of commits.
#
# git 2.55 removed `filter-branch` and `filter-repo` is not installed, so this
# replays each commit with the redactions applied to its tree. Author, committer,
# dates and messages are preserved; only file contents change.
#
# Use it when credentials were committed but NOT yet pushed. If they were
# already pushed, rewriting history is not enough — rotate the credentials.
#
#   ./deploy/redact-history.sh <base-ref> <branch> [extra-sed-expressions...]
#
# Example:
#   ./deploy/redact-history.sh origin/main feat/command-center-v0.4.0
# ══════════════════════════════════════════════════════════════
set -euo pipefail

BASE_REF="${1:?usage: redact-history.sh <base-ref> <branch> [patterns-file]}"
BRANCH="${2:?usage: redact-history.sh <base-ref> <branch> [patterns-file]}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
GIT_DIR_ABS="$(cd "$(git rev-parse --git-dir)" && pwd)"

PATTERNS_FILE="${3:-$REPO_ROOT/deploy/.redact-patterns}"

# Prefix-only patterns identify a credential TYPE, not a value, so they are
# safe to commit. Exact values (passwords, one-off keys) go in the ignored
# patterns file instead.
EXPRS=(
  's/pcp_board_[A-Za-z0-9_-]\{8,\}/REDACTED/g'
  's/cfut_[A-Za-z0-9_-]\{8,\}/REDACTED/g'
  's/sk-or-v1-[A-Za-z0-9]\{16,\}/REDACTED/g'
)

if [[ -f "$PATTERNS_FILE" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    EXPRS+=("$line")
  done < "$PATTERNS_FILE"
  echo "Loaded extra pattern(s) from ${PATTERNS_FILE#$REPO_ROOT/}"
else
  echo "No patterns file at $PATTERNS_FILE — applying prefix patterns only."
fi

BASE="$(git rev-parse "$BASE_REF")"
OLD_TIP="$(git rev-parse "$BRANCH")"
COMMITS=($(git rev-list --reverse "$BASE".."$OLD_TIP"))

if [[ ${#COMMITS[@]} -eq 0 ]]; then
  echo "nothing to replay: $BRANCH has no commits above $BASE_REF"
  exit 0
fi

echo "Replaying ${#COMMITS[@]} commit(s) from $BASE_REF..$BRANCH"
echo

TMP_BRANCH="redact-tmp-$$"
NEW="$BASE"

for C in "${COMMITS[@]}"; do
  SUBJECT="$(git log -1 --format=%s "$C")"

  TMP="$(mktemp -d)"
  IDX="$(mktemp)"
  rm -f "$IDX"

  # Materialise the commit's tree in a scratch worktree.
  GIT_DIR="$GIT_DIR_ABS" GIT_INDEX_FILE="$IDX" git read-tree "$C"
  GIT_DIR="$GIT_DIR_ABS" GIT_WORK_TREE="$TMP" GIT_INDEX_FILE="$IDX" \
    git checkout-index -a -f --prefix="$TMP/"

  # Redact every text file in the tree.
  CHANGED=0
  while IFS= read -r -d '' f; do
    if grep -qI . "$f" 2>/dev/null; then
      before="$(cksum < "$f")"
      for e in "${EXPRS[@]}"; do
        sed -i "$e" "$f"
      done
      after="$(cksum < "$f")"
      [[ "$before" != "$after" ]] && CHANGED=$((CHANGED + 1))
    fi
  done < <(find "$TMP" -type f -print0)

  # Rebuild the tree from the redacted worktree.
  IDX2="$(mktemp)"; rm -f "$IDX2"
  ( cd "$TMP" && GIT_DIR="$GIT_DIR_ABS" GIT_WORK_TREE="$TMP" GIT_INDEX_FILE="$IDX2" git add -A )
  TREE="$(GIT_DIR="$GIT_DIR_ABS" GIT_INDEX_FILE="$IDX2" git write-tree)"

  # Preserve author/committer identity and timestamps.
  export GIT_AUTHOR_NAME="$(git log -1 --format=%an "$C")"
  export GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$C")"
  export GIT_AUTHOR_DATE="$(git log -1 --format=%aI "$C")"
  export GIT_COMMITTER_NAME="$(git log -1 --format=%cn "$C")"
  export GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce "$C")"
  export GIT_COMMITTER_DATE="$(git log -1 --format=%cI "$C")"

  NEW="$(git log -1 --format=%B "$C" | GIT_DIR="$GIT_DIR_ABS" git commit-tree "$TREE" -p "$NEW")"

  rm -rf "$TMP" "$IDX" "$IDX2" 2>/dev/null || true
  printf '  %s  %s  (%d file(s) redacted)\n' "${NEW:0:8}" "$SUBJECT" "$CHANGED"
done

git update-ref "refs/heads/$BRANCH" "$NEW" "$OLD_TIP"
echo
echo "Updated $BRANCH -> ${NEW:0:8}"
echo "Old tip was ${OLD_TIP:0:8}; it is still reachable via the reflog if you need to go back."
