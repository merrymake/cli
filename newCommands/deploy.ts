import { choice, Formatting, shortText } from "../prompt.js";
import { PathToRepository } from "../types.js";
import {
  addToExecuteQueue,
  execStreamPromise,
  finish,
  outputGit,
  spawnPromise,
} from "../utils.js";

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
async function executeAndPrint(command: string) {
  try {
    const result: string[] = [];
    const onData = (s: string) => {
      result.push(s);
      outputGit(s);
    };
    await execStreamPromise(command, onData);
    return result.join("");
  } catch (e) {
    throw e;
  }
}

export async function do_deploy(pathToService: PathToRepository) {
  try {
    const before = process.cwd();
    process.chdir(pathToService.toString());
    const output = await do_deploy_internal(
      "(git diff-index --quiet HEAD 2>/dev/null || git commit -m 'Deploy with Merrymake')"
    );
    process.chdir(before);
    return !output.startsWith("Everything up-to-date");
  } catch (e) {
    throw e;
  }
}
function do_redeploy() {
  return spawnPromise(
    "git commit --allow-empty -m 'Redeploy with Merrymake' && git push origin HEAD 2>&1"
  );
}

function redeploy() {
  addToExecuteQueue(() => do_redeploy());
  return finish();
}

async function rebaseOntoMain() {
  try {
    const output = await executeAndPrint(
      `git fetch && git rebase origin/main && git push origin HEAD:main 2>&1`
    );
    if (output.trimEnd().endsWith("Everything up-to-date"))
      return choice(
        "Would you like to redeploy?",
        [
          {
            long: "again",
            text: "deploy again",
            action: () => redeploy(),
          },
        ],
        { disableAutoPick: true }
      );
    return finish();
  } catch (e) {
    throw e;
  }
}

async function getMessage() {
  try {
    const message = await shortText(
      "Describe your changes: This commit will ",
      "Write in future tense 'refactor module X'",
      null,
      { formatting: Formatting.Minimal }
    );
    const msg =
      message.length === 0
        ? "[No message]"
        : message[0].toUpperCase() + message.substring(1);
    await spawnPromise(`git commit -m "${msg}"`);
    return rebaseOntoMain();
  } catch (e) {
    throw e;
  }
}

export async function deploy() {
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
    return dirty ? getMessage() : rebaseOntoMain();
    // const didDeploy = await do_deploy(new PathToRepository("."));
    // if (didDeploy) return finish();
    // else
    //   return choice(
    //     "Would you like to redeploy?",
    //     [
    //       {
    //         long: "again",
    //         text: "deploy again",
    //         action: () => redeploy(),
    //       },
    //     ],
    //     { disableAutoPick: true }
    //   );
  } catch (e) {
    throw e;
  }
}
