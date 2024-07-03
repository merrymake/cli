import { choice } from "../prompt";
import { PathToRepository } from "../types";
import {
  addToExecuteQueue,
  execStreamPromise,
  finish,
  output2,
} from "../utils";

async function do_deploy_internal(commit: string) {
  try {
    const result: string[] = [];
    const onData = (s: string) => {
      result.push(s);
      output2(s);
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
    const output = await do_deploy_internal(
      "(git diff-index --quiet HEAD 2>/dev/null || git commit -m 'Deploy')"
    );
    process.chdir(before);
    return !output.startsWith("Everything up-to-date");
  } catch (e) {
    throw e;
  }
}
export function do_redeploy() {
  return do_deploy_internal("git commit --allow-empty -m 'Redeploy'");
}

export async function deploy() {
  try {
    const didDeploy = await do_deploy(new PathToRepository("."));
    if (didDeploy) return finish();
    else
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
  } catch (e) {
    throw e;
  }
}

export function redeploy() {
  addToExecuteQueue(() => do_redeploy());
  return finish();
}
