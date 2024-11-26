import {
  BUILD_SCRIPT_MAKERS,
  detectProjectType,
} from "@merrymake/detect-project-type";
import { addToExecuteQueue, finish, output2, spawnPromise } from "../utils";

export async function do_build() {
  try {
    const projectType = detectProjectType(".");
    output2(`Building ${projectType} project...`);
    const buildCommands = BUILD_SCRIPT_MAKERS[projectType](".");
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
