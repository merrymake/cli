# NEXT: 
## Breaking changes
- 
## Added features
- 
## Fixes and improvements
- 

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
