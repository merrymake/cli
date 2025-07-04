import { finish } from "../exitMessages.js";
import { choice, Formatting, output, shortText } from "../prompt.js";
import { PathToRepository } from "../types.js";
import { execStreamPromise } from "../utils.js";
import { execute, outputGit, spawnPromise } from "../printUtils.js";
import { isDryrun } from "../dryrun.js";

/*
[remove .gitignored files]
[clean workspace]
*/

/*
git add -A
git diff-index --quiet HEAD 2>/dev/null [exitCode to detect dirty working tree]
if dirty
  read MSG
  git commit -m "MSG"
git fetch
git rebase origin/main
git push origin HEAD:main 2>&1
if "Everything up to date"
  ask redeploy?
  git commit --allow-empty -m "Redeploy (empty)"
*/

async function do_deploy_internal(commit: string) {
  try {
    const result: string[] = [];
    const onData = (s: string) => {
      result.push(s);
      outputGit(s);
    };
    await execStreamPromise(
      `git add -A && ${commit} && git push origin HEAD 2>&1`,
      onData
    );
    return result.join("");
  } catch (e) {
    throw e;
  }
}

export async function do_deploy(pathToService: PathToRepository) {
  try {
    const before = process.cwd();
    process.chdir(pathToService.toString());
    if (isDryrun()) {
      output("DRYRUN: Would commit changes");
    } else
      await do_deploy_internal(
        "(git diff-index --quiet HEAD 2>/dev/null || git commit -m 'Deploy with Merrymake')"
      );
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}
async function do_redeploy() {
  if (isDryrun()) {
    output("DRYRUN: Would make empty commit and push");
  } else
    await spawnPromise(
      "git commit --allow-empty -m 'Redeploy with Merrymake' && git push origin HEAD 2>&1"
    );
}

async function redeploy() {
  await do_redeploy();
  return finish();
}

async function rebaseOntoMain(monorepo: boolean) {
  try {
    const remoteHead = ((a) => {
      const mat = a.match(/ref: refs\/heads\/(.+)\t/);
      return mat === null ? undefined : mat[1];
    })(await execute(`git ls-remote --symref origin HEAD 2>&1`));
    if (isDryrun()) {
      output("DRYRUN: Would push changes to remote");
    } else {
      const output = await execute(
        (remoteHead !== undefined
          ? `git fetch && ({ ! git ls-remote --exit-code origin ${remoteHead} >/dev/null; } || git rebase origin/${remoteHead}) && `
          : "") + `git push origin HEAD:${remoteHead || "main"} 2>&1`,
        true
      );
      if (output.trimEnd().endsWith("Everything up-to-date") && !monorepo) {
        return choice(
          [
            {
              long: "again",
              text: "deploy again",
              action: () => redeploy(),
            },
          ],
          async () => {
            return { options: [], header: "Would you like to redeploy?" };
          },
          { disableAutoPick: true }
        );
      }
    }
    return finish();
  } catch (e) {
    throw e;
  }
}

async function getMessage(monorepo: boolean) {
  try {
    output("Describe your changes (optional):");
    const message = await shortText(
      "This commit will ",
      "Write in future tense 'refactor module X'",
      null,
      { formatting: Formatting.Minimal }
    );
    const msg =
      message.length === 0
        ? "[No message]"
        : message[0].toUpperCase() + message.substring(1);
    if (isDryrun()) {
      output("DRYRUN: Would commit changes");
    } else await spawnPromise(`git commit -m "${msg}"`);
    return rebaseOntoMain(monorepo);
  } catch (e) {
    throw e;
  }
}

export async function deploy(monorepo: boolean) {
  try {
    const dirty = await (async () => {
      try {
        await spawnPromise(
          `git add -A && git diff-index --quiet HEAD 2>/dev/null`
        );
        return false;
      } catch (e) {
        return true;
      }
    })();
    return dirty ? getMessage(monorepo) : rebaseOntoMain(monorepo);
  } catch (e) {
    throw e;
  }
}
