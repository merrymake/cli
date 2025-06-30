import { Obj } from "@merrymake/utils";
import { readFile } from "fs/promises";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { multiSelect, output } from "../prompt.js";
import { RepositoryId } from "../types.js";
import { sshReq } from "../utils.js";
import { isDryrun } from "../dryrun.js";

async function do_rollback(repositoryId: RepositoryId, hooks: string[]) {
  if (isDryrun()) {
    output("DRYRUN: Would roll back");
    return;
  }
  try {
    outputGit(
      await sshReq(
        `deployment-rollback`,
        `\\"${repositoryId}\\"`,
        `--hooks`,
        hooks.join(",")
      )
    );
  } catch (e) {
    throw e;
  }
}

async function rollback_hooks(repositoryId: RepositoryId, hooks: string[]) {
  if (hooks.length > 0) await do_rollback(repositoryId, hooks);
  else outputGit("No hooks selected for rollback.");
  return finish();
}

export async function rollback(repositoryId: RepositoryId) {
  try {
    const resp: { hooks: { [river_event: string]: unknown } } = JSON.parse(
      await readFile("merrymake.json", "utf-8")
    );
    const river_events = Obj.Sync.map(resp.hooks, (k, v) => true);
    return await multiSelect(
      "Which hooks would you like to roll back?",
      river_events,
      (s) =>
        rollback_hooks(
          repositoryId,
          Obj.keys(s).filter((x) => s[x])
        ),
      "No hooks found in merrymake.json."
    );
  } catch (e) {
    throw e;
  }
}
