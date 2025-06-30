import { detectProjectType, ProjectTypes, } from "@merrymake/detect-project-type";
import { finish } from "../exitMessages.js";
import { outputGit, spawnPromise } from "../printUtils.js";
import { output } from "../prompt.js";
import { isDryrun } from "../dryrun.js";
async function do_update() {
    if (isDryrun()) {
        output("DRYRUN: Would update dependencies");
        return;
    }
    try {
        const projectType = await detectProjectType(".");
        outputGit(`Updating ${projectType} dependencies...`);
        const commands = await ProjectTypes[projectType].update(".");
        for (let i = 0; i < commands.length; i++) {
            const x = commands[i];
            await spawnPromise(x);
        }
    }
    catch (e) {
        throw e;
    }
}
export async function update() {
    await do_update();
    return finish();
}
