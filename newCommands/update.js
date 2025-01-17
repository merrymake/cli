import { detectProjectType, ProjectTypes, } from "@merrymake/detect-project-type";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit, spawnPromise } from "../printUtils.js";
async function do_update() {
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
export function update() {
    addToExecuteQueue(() => do_update());
    return finish();
}
