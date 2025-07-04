<!--
# NEXT:
## Breaking changes
-
## Added features
-
## Fixes and improvements
-
-->

# 5.0.2
## Fixes and improvements
- Fix `sim` after dependency update

# 5.0.1
## Fixes and improvements
- Fix an issue with `start`
- Make `inspect` more space efficient
- Correct exit code for `x`
- Make dryrun work when `post`ing files

# 5.0.0
## Breaking changes
- Made service `group` actions consistent with others (eg. `mm delete` => `mm group XXX delete`, `mm group` => `mm group new`)
- Made folder names more intuitive (eg. `event-catalogue` => `event-configuration`, `public` => `front-end`, `service-group-1` => `back-end`)
- `mm org new` no longer asks for names for the service group and repo, since they can simply be renamed later
## Fixes and improvements
- More responsive. Generalized code for skipping server response if argument is given (ie. `mm rapids post`)
- `dryrun` should work more reliably
- Added short-hand for `version` (`-v`)
- Made `start`, `init` (as npm), and `--init` (as tsc) into aliases for `register`
- Prepared some of the features we are working on
- On immediate post to a new service, don't ask for event type

# 4.10.2
## Fixes and improvements
- `keys` table fixed

# 4.10.1
## Fixes and improvements
- `rapids` now buckets cached-requests together
- Try harder to avoid fingerprint question from SSH
- Don't fail `deploy` in new repos
- Don't suggest duplicating the `repo` you are creating

# 4.10.0
## Added features
- Can select which email to `join` with
- Can time limit `role` assignment
- `rapids` shows dead-letter requests
## Fixes and improvements
- Reenabled `help`
- After implementing two very complex grouping algorithms for `rapids` (Freedman–Diaconis rule and Knuth's rule) we discovered that a simple square root rule gave better results
- `rapids` shows visualization instead of median
- `rapids` prints lines to separate days

# 4.9.0
## Added features
- Add `update` command, used to update dependencies in service repositories. No breaking changes (ie. minor)
- Add `upgrade` command, used to upgrade dependencies in service repositories, _including_ breaking changes (ie. major)
## Fixes and improvements
- Link release notes in the update message
- Lock dependency version even harder, made possible by the two new commands described above
- Make the 'Event' column of `rapids` fit the width of events, without slowing it down

# 4.8.0
## Added features
- `rapids` prints relative times for recent events
## Fixes and improvements
- Lock dependency versions, since we don't have control over deployment time (ie. when people install it)
- `rapids` uses a 24h time format to avoid overflow from AM/PM
- `rapids` move 'day' column to make it easier to see on wide terminals

# 4.7.0
## Added features
- `rapids` now also separates on days, and uses more data to provide even better groupings
- `rapids` colored to make important information more easily discernable
- `inspect` and `sim` outputs less clutter and breaks lines better, also supports color
## Fixes and improvements
- Commands print the final choice when passing `x` on the commandline (useful for scripting)
- Fix crashes when there were very few options, which didn't have a short key
- Fix crash on large `rapids` output (~3k requests, increased to ~10k)
- Speed up `rapids post`

# 4.6.0
## Added features
- `rapids` shows traces in intelligent groups, providing better overview in case of many events
- `inspect` shows output from entire trace
## Fixes and improvements
- Hide pending users in `role`
- If the first 0-9 options don't have letter triggers, they get a number

# 4.5.1
## Fixes and improvements
- CORS in `sim` to allow setting content-type
- `delete` service group now works
- `deploy` targets the remote's HEAD branch instead of always `main`
- `build` skips npm install more often

# 4.5.0
## Added features
- `repo` option to `duplicate` an existing repo
- `hosting` asks which bitbucket branch should be the release branch
## Fixes and improvements
- Breadcrumb is again printing "mm" or "mmk" instead of "undefined"
- Fix `deploy` fails with "origin/main not found" on the first deploy
- More space for change message in `deploy`
- Fix `sim` fails on Mac when started inside group or repo
- Merge the sequential choices "template vs empty" and "language"

# 4.4.4
## Fixes and improvements
- Simulator serves bytes correctly
- Simulator doesn't warn of dead ends for $-messages

# 4.4.3
## Fixes and improvements
- Simulator doesn't crash on logging empty lines

# 4.4.2
## Fixes and improvements
- Simulator's service detection ignores files

# 4.4.1
## Fixes and improvements
- Simulator parsing body correctly
- Don't crash if no arguments

# 4.4.0
## Added features
- Basic local `sim`-ulator
- `delete` service groups
- Can crete service user with `role`
## Fixes and improvements
- `deploy` asks for a message if there are changed files and colors the deployment output to make it easier to read
- hide 'pending' users from main view
- `build` skips library install if up-to-date

# 4.2.0
## Added features
- Readded `build` command
## Fixes and improvements
- Fix bug where repos would be empty after `fetch` or `org checkout`
- Prevent checking out an organization into an existing folder

# 4.1.0
## Added features
- `rename` an organization
## Fixes and improvements
- `rapids post` now prints the url, for easy reuse
- change `apikey` 'description' to 'display name'
- allow '^' in text input
- `envvar` now auto-selects current setting when editing
- `event` now only puts 's' ending for multiple events

# 4.0.2
## Fixes and improvements
- Fixed issue with `rapids` inspecting events starting with -
- Stop an error with some terminals failing
- Fix issue that would persist key for too long

# 4.0.1
## Fixes and improvements
- `key` command column width fixed
- Show newly created API keys
- "smoke test" => "init run" in `envvar` command
- "Rapids" => "rapids" in `repo` command

# 4.0.0
## Breaking changes
- Reworked everything to fit with Merrymake 2.0

# 3.4.0
## Added features
- Add timezone to `cron`

# 3.3.0
## Added features
- Add `file` option to `post` command
## Fixes and improvements
- Fix some issues with `hosting` command
- Fix reply type for errors

# 3.2.0
## Added features
- Add `hosting` command to setup BitBucket hosting with service user

# 3.1.0
## Added features
- Ability to `replay` service runs from `queue`
## Fixes and improvements
- Underscore `_` auto-selects the default option
- Remove some old debugging logging
- Remove the word "keep" from secret envvar selection
- Add option to delete envvar without selecting visibility
- Add short header question to all choices

# 3.0.0
## Breaking changes
- Change order of questions for envvar so secrets can be hidden as *s
## Fixes and improvements
- Add indicator when in dryrun mode
- Add command timeout in case the server is unreachable
- Better name suggestion for `repo` and `group`
- Encrypt secrets on the client-side

# 2.1.4
## Fixes and improvements
- Fix `register` bug when manually adding ssh-key without `.ssh` folder
- Allow more symbols in text field
- Tell user to run `register` first

# 2.1.3
## Fixes and improvements
- Fix `register` not showing `new` subcommand for new users

# 2.1.2
## Fixes and improvements
- Fix display of english date time in `queue` and `key`

# 2.1.1
## Fixes and improvements
- Allow more characters in text fields ('<>\')
- Fix 'dot' bug
- Better error message for `post` when there are no active keys

# 2.1.0
## Added features
- Add context sensitive `delete` command
## Fixes and improvements
- Trying to fix delete in text fields on Mac

# 2.0.0
## Breaking changes
- Make `event` use a multiselect, because it is much easier, safer, and faster to use, and can give a more helpful error message.
## Fixes and improvements
- Allow '-' in text inputs
- Change update command to install with @latest, to allow major version updates

# 1.11.1
## Fixes and improvements
- Fix `stats` command with count < 1000

# 1.11.0
## Added features
- Add `stats` command for viewing usage breakdown for the last two months
## Fixes and improvements
- Make columns wider in `cron` command

# 1.10.0
## Added features
- Add `role` command for assigning roles to users, and configuring auto approving users with specific email domains
- Add `join` command for requesting to join an existing organization
## Fixes and improvements
- Better error message when simulator encounters an un-built service

# 1.9.1
## Fixes and improvements
- Allow `deploy` and `redeploy` inside `public`
- Allow `register` inside `organization`
- Print the expected context of common commands
- Change default naming for service-groups ('services' => 'service-group-1') and services ('Merrymake' => 'service-1'), because it makes the structure more clear and suggests that you can have multiple of each

# 1.9.0
## Added features
- Don't ask for visibility when deleting an environment variable
## Fixes and improvements
- Fix simulator directory detection on Mac

# 1.8.1
## Fixes and improvements
- Insert ssh host config in the top of the file, to avoid being shadowed by *
- Ability to call CLI from shell script (without TTY)
- Rename `Name` to `Description` in `key` command, and make it dynamic width
- Add warning when creating anonymous account

# 1.8.0

## Added features
- Add `post` command
## Fixes and improvements
- Don't print command when selecting default
- `public` excluded from service groups
- Fix bug where fetch would not initialize the git repos
- Make `clone` command slightly faster
- Add `.md` to `CHANGELOG` for better syntax highlighting

# 1.7.0

- Add $broadcast and $join
- Rework sessionId

# 1.6.9

- Add support for local envvars defined in [group]/env.kv in the format "KEY=value\n"
- Experiment with sessionId
- Don't ask about accessibility and environment when deleting envvars

# 1.6.6

- Fix .ssh/config when calling `register` multiple times
- Fix bug with null as default for text

# 1.6.5

- Add internet connection test to `help`
- Change over to api.merrymake.io
- Check known_host on permission error

# 1.6.4

- Introduced CHANGELOG 🥳
- Fixed bug if git.initialBranch is master
