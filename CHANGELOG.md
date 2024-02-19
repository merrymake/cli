# NEXT:
## Breaking changes
-
## Added features
-
## Fixes and improvements
-

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
