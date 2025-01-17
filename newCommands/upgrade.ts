import {
  detectProjectType,
  ProjectTypes,
} from "@merrymake/detect-project-type";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit, spawnPromise } from "../printUtils.js";

async function do_upgrade() {
  try {
    const projectType = await detectProjectType(".");
    outputGit(`Upgrading ${projectType} dependencies...`);
    const commands = await ProjectTypes[projectType].upgrade(".");
    for (let i = 0; i < commands.length; i++) {
      const x = commands[i];
      await spawnPromise(x);
    }
  } catch (e) {
    throw e;
  }
}

export function upgrade() {
  addToExecuteQueue(() => do_upgrade());
  return finish();
}
