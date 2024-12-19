import {
  detectProjectType,
  ProjectTypes,
} from "@merrymake/detect-project-type";
import {
  addToExecuteQueue,
  finish,
  outputGit,
  spawnPromise,
} from "../utils.js";

export async function do_build() {
  try {
    const projectType = await detectProjectType(".");
    outputGit(`Building ${projectType} project...`);
    const buildCommands = await ProjectTypes[projectType].build(".");
    for (let i = 0; i < buildCommands.length; i++) {
      const x = buildCommands[i];
      await spawnPromise(x);
    }
  } catch (e) {
    throw e;
  }
}

export function build() {
  addToExecuteQueue(() => do_build());
  return finish();
}
