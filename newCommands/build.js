import { detectProjectType, ProjectTypes, } from "@merrymake/detect-project-type";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit, spawnPromise } from "../printUtils.js";
async function do_build() {
    try {
        const projectType = await detectProjectType(".");
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
export function build() {
    addToExecuteQueue(() => do_build());
    return finish();
}
