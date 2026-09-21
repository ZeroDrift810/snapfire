#!/usr/bin/env bash
# Deploy the iMoveChainz bot to exe-host (Ubuntu, PM2 process `imovechainz`).
# Usage: commit + push `main`, then ./deploy-exe.sh
#
# WHY THIS FILE EXISTS. It replaces `deploy imovechainz`, the central ~/.deploy tool.
# Ruling 2026-09-20: a per-repo COMMITTED script is canonical. $HOME is the one place
# that does not survive a machine move, which is exactly how the central tool went
# missing in the 2026-09-19 migration while every MANUAL still pointed at it. A
# committed script cannot be lost, and it also runs from exe-host itself or a cloud
# session, where a PowerShell $PROFILE function never could.
#
# The recipe below is verbatim from the old apps.json entry, not reinvented:
#   host exe · path /home/himkage/imovechainz-bot · branch main
#   install `npm ci` · build `npm run build` · restart `pm2 restart imovechainz`
set -euo pipefail

# ---------------------------------------------------------------------------
# RESET RATHER THAN `git pull --ff-only`, ON PURPOSE.
# The other repos here pull. This one resets, because that is the contract this
# bot has always had and MANUAL.md states it outright: the host must never hold
# local edits, and anything edited there gets wiped by the next deploy. Reset
# guarantees the host converges on origin no matter what state it is in.
# The tradeoff, so the next person can weigh it: --ff-only would FAIL LOUDLY on a
# host that somehow holds a local commit, where reset destroys it silently. If you
# ever need to inspect the host's state, do it before running this, not after.
#
# `npm ci` RATHER THAN `npm install`, ALSO ON PURPOSE.
# This bot has a NATIVE dependency (@resvg/resvg-js) that renders the playcall
# diagrams. Native modules ship per-arch binaries, so the host must resolve its
# own (linux-x64) rather than inherit anything from a Windows dev box. Never copy
# node_modules to a host.
#
# `&&` RATHER THAN `;` BEFORE THE RESTART, ON PURPOSE.
# Lifted from League Ops Pro, where it cost an hour on 2026-08-24. With semicolons
# the bot restarts even when the BUILD FAILED: tsc refuses to emit a torn dist, so
# the OLD dist survives, pm2 comes back clean, the boot banner appears, and the
# script prints success while running the PREVIOUS build. A deploy that silently
# ships the last build is worse than one that errors.
# ---------------------------------------------------------------------------

echo "[deploy] exe-host: reset to origin/main, install, build, restart, verify..."
# THE RESTART AND THE VERIFICATION SHARE ONE SSH SESSION ON PURPOSE, so the check can
# hold a timestamp taken immediately BEFORE the restart. See the stale-banner note.
ssh exe 'set -e
  cd /home/himkage/imovechainz-bot
  git fetch --all -q && git reset --hard -q origin/main && npm ci --no-audit --no-fund && npm run build

  # STAMP THE MOMENT OF RESTART. Everything below only trusts log lines at or after it.
  # NOT `date -u`. pm2 prefixes its log lines in the HOST LOCAL zone (EDT here), so a UTC
  # stamp sits 4-5 hours in the future and no real banner ever compares as new enough.
  # Found by running it: the check reported "did NOT come up clean" against a bot that had
  # booted perfectly one second earlier. Worth noting that it failed CLOSED, which is the
  # right direction for a deploy check to be wrong in, but a verifier that cries wolf gets
  # ignored just as fast as one that never fires.
  TS=$(date +%Y-%m-%dT%H:%M:%S)
  pm2 restart imovechainz --update-env >/dev/null

  # WAIT ON A BANNER FROM *THIS* BOOT, NOT ANY BANNER.
  # Lifted from LO Pro: read the OUT log only, because pm2 keeps the ERR log across
  # restarts and one stale line there makes a good deploy look failed.
  # THEN THE SHARPER VERSION OF THE SAME BUG, FOUND HERE ON 2026-09-20 BY RUNNING THIS
  # SCRIPT AND READING ITS OUTPUT: the OUT log is kept across restarts too. The first
  # version of this loop grepped for the banner with no timestamp test, matched the
  # PREVIOUS boot instantly, and reported a clean deploy 25 seconds into a restart it
  # had never actually observed. It would have passed a boot that crashed on startup.
  # A verification that cannot fail is not a verification.
  end=$((SECONDS+70)); ok=0
  while [ $SECONDS -lt $end ]; do
    seen=$(pm2 logs imovechainz --lines 200 --nostream --out 2>/dev/null \
      | sed "s/\x1b\[[0-9;]*m//g" | grep "iMoveChainz Bot is online" \
      | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}" | tail -1)
    # ISO-8601 in a fixed field sorts lexically, so string compare is a valid time compare.
    if [ -n "$seen" ] && { [ "$seen" \> "$TS" ] || [ "$seen" = "$TS" ]; }; then ok=1; break; fi
    sleep 3
  done

  echo "--- boot (restart stamped $TS) ---"
  if [ $ok -eq 1 ]; then
    pm2 logs imovechainz --lines 200 --nostream --out 2>/dev/null | sed "s/\x1b\[[0-9;]*m//g" \
      | grep -E "Bot is online|Teaching cards:|Playbook \(CFB27\):" | tail -3
  else
    echo "!! NO boot banner from this restart within 70s. The bot did NOT come up clean."
    echo "!! Do not walk away. Check: ssh exe \"pm2 logs imovechainz --lines 50 --nostream\""
  fi

  echo "--- recent stderr (MAY PREDATE THIS RESTART, not proof of a bad deploy) ---"
  pm2 logs imovechainz --lines 20 --nostream --err 2>/dev/null | sed "s/\x1b\[[0-9;]*m//g" | tail -3
  [ $ok -eq 1 ]'

# REPO-SPECIFIC, AND THE REASON IT IS HERE. The boot banner prints card and playbook
# counts but says NOTHING about engine/, so a STALE VENDORED CORPUS BOOTS LOOKING
# PERFECTLY HEALTHY. That is precisely how play-data.js sat two upstream commits
# behind from 2026-07-05 to 2026-09-20 with nobody noticing. Print what the live
# process actually loaded so a bad engine deploy is visible here, not months later.
echo "[deploy] live engine corpus:"
ssh exe "cd /home/himkage/imovechainz-bot && node -e \"const d=require('./engine/play-data.js');console.log('   ' + Object.keys(d.coverages).length + ' coverages (' + Object.keys(d.coverages).join(',') + ')');console.log('   mesh-under depth ' + d.routes['mesh-under'].depth_yd + ', shallow depth ' + d.routes['shallow'].depth_yd + ', ' + d.plays.length + ' plays')\""

echo "[deploy] done."
echo "[deploy] NOTE: .env and the CFB play art are gitignored, so a pull does not carry them."
echo "[deploy]       If you changed either, scp them across separately."
