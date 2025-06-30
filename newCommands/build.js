import { detectProjectType, ProjectTypes, } from "@merrymake/detect-project-type";
import { finish } from "../exitMessages.js";
import { outputGit, spawnPromise } from "../printUtils.js";
import { output } from "../prompt.js";
import { isDryrun } from "../dryrun.js";
async function do_build() {
    try {
        const projectType = await detectProjectType(".");
        if (isDryrun()) {
            output(`DRYRUN: Would build ${projectType} project`);
            return;
        }
        outputGit(`Building ${projectType} project...`);
        const commands = await ProjectTypes[projectType].build(".");
        for (let i = 0; i < commands.length; i++) {
            const x = commands[i];
            await spawnPromise(x);
        }
    }
    catch (e) {
        throw e;
    }
}
export async function build() {
    await do_build();
    return finish();
}
