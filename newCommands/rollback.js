import { Obj } from "@merrymake/utils";
import { readFile } from "fs/promises";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { multiSelect, output } from "../prompt.js";
import { sshReq } from "../utils.js";
import { isDryrun } from "../dryrun.js";
async function do_rollback(repositoryId, hooks) {
    if (isDryrun()) {
        output("DRYRUN: Would roll back");
        return;
    }
    try {
        outputGit(await sshReq(`deployment-rollback`, `\\"${repositoryId}\\"`, `--hooks`, hooks.join(",")));
    }
    catch (e) {
        throw e;
    }
}
function rollback_hooks(repositoryId, hooks) {
    if (hooks.length > 0)
        addToExecuteQueue(() => do_rollback(repositoryId, hooks));
    else
        outputGit("No hooks selected for rollback.");
    return finish();
}
export async function rollback(repositoryId) {
    try {
        const resp = JSON.parse(await readFile("merrymake.json", "utf-8"));
        const river_events = Obj.Sync.map(resp.hooks, (k, v) => true);
        return await multiSelect("Which hooks would you like to roll back?", river_events, (s) => rollback_hooks(repositoryId, Obj.keys(s).filter((x) => s[x])), "No hooks found in merrymake.json.");
    }
    catch (e) {
        throw e;
    }
}
