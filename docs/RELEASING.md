# Releasing & rolling back Patakha

Nothing changes without a record, and every release can be restored.

## The rules

1. **Every change goes in `CHANGELOG.md`.** Add a line under `## [Unreleased]` while you work. Group lines under *Added / Changed / Fixed / Removed*.
2. **`version.json` is the only place the version lives.** The Android build reads it and Settings shows it.
   - `version`: semantic version. PATCH (1.1.**1**) for fixes and tweaks, MINOR (1.**2**.0) for new features, MAJOR (**2**.0.0) for big or breaking changes.
   - `versionCode`: a whole number that **must increase for every Google Play upload**. Play rejects equal or lower numbers.
3. **Every release gets a git tag** `vX.Y.Z` on its commit, which is the restore point. The *Tag releases* GitHub workflow creates missing tags automatically from the commit hashes in `CHANGELOG.md` and from `version.json`. Locally, `scripts/tag-releases.sh` does the same. If GitHub's bot can't create a tag (it refuses commits whose workflow files differ from today's), create it from a computer with `git fetch && scripts/tag-releases.sh && git push origin --tags`, or just use `scripts/rollback.sh`, which falls back to the CHANGELOG hash.
4. **History is never rewritten.** Undoing happens with *new* commits (see Rollback), so nothing is ever lost.
5. **Every released `.aab`/`.apk` is kept.** Attach them to a GitHub Release for that tag, or keep the Actions artifact.

The GitHub check `.github/workflows/changelog.yml` (also runnable locally as `scripts/check-changelog.sh`) fails when code changes without a CHANGELOG entry, when `version.json` has no matching CHANGELOG section, or when `versionCode` goes down.

## Making a release

```bash
# 1. finish the work; CHANGELOG.md [Unreleased] lists every change
# 2. rename "[Unreleased]" to "[0.2.0] — YYYY-MM-DD · Play build 2" and add a fresh empty [Unreleased]
# 3. bump version.json → {"version": "0.2.0", "versionCode": 2, "date": "YYYY-MM-DD"}
scripts/check-changelog.sh                  # must print ✓
git commit -am "Release 0.2.0"
git push                                    # the Tag releases workflow then tags v0.2.0 automatically
# (or manually: git tag -a v0.2.0 -m "Patakha 0.2.0" && git push origin v0.2.0)
# 4b. once tagged, add that commit's short hash to its CHANGELOG heading in the next change:  · `abc1234`
# 4. build: cd android && ./gradlew lintRelease bundleRelease assembleRelease   (or run the GitHub "Android build" workflow)
# 5. upload app-release.aab to Play (internal testing first), and keep the file with the tag
```
Netlify deploys the website automatically from the pushed commit.

## Rolling back

### Website (Netlify) — instant
Netlify dashboard → your site → **Deploys** → open an older deploy → **Publish deploy**. The site goes back immediately, with no code change. Afterwards, fix or roll back the code too (below) so the next push doesn't bring the problem back.

### Code — safe, no history lost
```bash
git tag -l                                  # list restore points
git diff v0.1.0 HEAD --stat                 # see what changed since then
scripts/rollback.sh v0.1.0                  # restores files to v0.1.0 (keeps CHANGELOG/version.json);
                                            # works even without the tag, using the commit hash in CHANGELOG.md
# then bump version.json (higher versionCode), add a CHANGELOG entry
#   "### Changed — Rolled back to v0.1.0 because …", commit, tag, push.
```
To undo just **one** bad commit: `git revert <commit-hash>`. This also adds a CHANGELOG entry.

Just to look at an old version without changing anything: `git switch --detach v0.1.0` (return with `git switch -`).

### Google Play app
Play never lets you upload a lower `versionCode`, and users can't be downgraded. So:
- **If a rollout is still in progress:** Play Console → Release → *Halt rollout*. Users who haven't updated stay on the old version.
- **Otherwise:** roll the code back (above), give it a **higher** `versionCode`, build and upload it as the new release.
- Tip: release to **Internal testing** first, then use a **staged rollout** (e.g. 10% → 50% → 100%) for production.

## Version history
See [`CHANGELOG.md`](../CHANGELOG.md). Tags: `git tag -l -n1`.

## Closed testing (needed once per new app)
Personal Play developer accounts must run a **closed test with at least 12 testers opted in for 14 days in a row** before the app can go to production. Reuse the same tester list for every ARTIN Studios app. Upload the first `.aab` to the closed track as early as possible: the 14 days only start counting once 12 testers have opted in.
