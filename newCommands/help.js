import { Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { REPOSITORY, SERVICE_GROUP } from "../config.js";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { sshReq, urlReq } from "../utils.js";
async function do_help(ctx) {
    try {
        const whoami = JSON.parse(await sshReq("me-whoami"));
        if (whoami === undefined || whoami.length === 0) {
            outputGit(`Warning: No verified email. Run 'mm register'`);
        }
        else {
            outputGit(`Logged with: ${Str.FG_GREEN}${Str.list(whoami.map((x) => Str.censor(x)))}${Str.FG_DEFAULT}`);
        }
    }
    catch (e) {
        try {
            await urlReq("https://google.com");
        }
        catch (e) {
            outputGit(`Error: No internet connection.`);
        }
    }
    if (ctx.organization === undefined) {
        outputGit(`Warning: Not inside organization.`);
    }
    else {
        outputGit(`${Str.FG_GRAY}Inside organization (${ctx.organization.id}).${Str.FG_DEFAULT}`);
    }
    if (ctx.serviceGroup === undefined) {
        outputGit(`Warning: Not inside ${SERVICE_GROUP}.`);
    }
    else {
        outputGit(`${Str.FG_GRAY}Inside ${SERVICE_GROUP} (${ctx.serviceGroup.id}).${Str.FG_DEFAULT}`);
    }
    if (!existsSync("merrymake.json")) {
        outputGit(`Warning: Not inside ${REPOSITORY}.`);
    }
    else {
        outputGit(`${Str.FG_GRAY}Inside ${REPOSITORY} (${ctx.repositoryId}).${Str.FG_DEFAULT}`);
    }
}
export async function help(ctx) {
    await do_help(ctx);
    return finish();
}
