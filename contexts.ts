import { Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { lstat, readdir } from "fs/promises";
import path from "path";
import { REPOSITORY, SERVICE_GROUP, SPECIAL_FOLDERS } from "./config.js";
import { COMMAND_COLOR } from "./printUtils.js";
import { Path, directoryNames, fetchOrgRaw } from "./utils.js";

async function downOrg(cmd: string) {
  try {
    const folders = await readdir(".");
    let org = undefined;
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      if (existsSync(path.join(folder, ".merrymake"))) {
        org = folder;
        break;
      }
    }
    let hint = `You can only run '${
      COMMAND_COLOR + cmd + Str.FG_DEFAULT
    }' from inside an organization.`;
    if (org !== undefined) {
      hint += `\nUse '${COMMAND_COLOR}cd ${org}${Str.FG_DEFAULT}' or one of these:`;
    } else {
      hint += `\nUse one of these:`;
    }
    return hint;
  } catch (e) {
    throw e;
  }
}
async function upOrg(cmd: string) {
  try {
    const struct = await fetchOrgRaw();
    if (struct.org === null) return downOrg(cmd);
    else {
      let hint = `You can only run '${cmd}' from the organization root folder.`;
      hint += `\nUse '${COMMAND_COLOR}cd ${struct.pathToRoot.substring(
        0,
        struct.pathToRoot.length - 1
      )}${Str.FG_DEFAULT}' or one of these:`;
      return hint;
    }
  } catch (e) {
    throw e;
  }
}

const SERVICE_CONTEXT = async (cmd: string) => {
  try {
    let hint = `You can only run '${cmd}' from inside a ${REPOSITORY}.`;
    const bfs = ["."];
    while (bfs.length !== 0) {
      const cur = bfs.shift()!;
      if (existsSync(path.join(cur, "merrymake.json"))) {
        hint += `\nUse '${COMMAND_COLOR}cd ${cur.replace(/\\/g, "\\\\")}${
          Str.FG_DEFAULT
        }' or one of these:`;
        break;
      } else {
        try {
          if ((await lstat(cur)).isDirectory())
            bfs.push(...(await readdir(cur)).map((x) => path.join(cur, x)));
        } catch (e) {}
      }
    }
    return hint;
  } catch (e) {
    throw e;
  }
};
const NOT_SERVICE_CONTEXT = (cmd: string) => {
  let hint = `You cannot run '${cmd}' from inside a ${REPOSITORY}.`;
  hint += `\nUse '${COMMAND_COLOR}cd ..${Str.FG_DEFAULT}' or one of these:`;
  return Promise.resolve(hint);
};
const SERVICE_GROUP_CONTEXT = async (cmd: string) => {
  try {
    const struct = await fetchOrgRaw();
    const serviceGroups = await directoryNames(
      new Path(struct.pathToRoot!),
      SPECIAL_FOLDERS
    );
    let hint = `You can only run '${cmd}' from inside a ${SERVICE_GROUP}.`;
    hint += `\nUse '${COMMAND_COLOR}cd ${path
      .join(struct.pathToRoot!, serviceGroups[0].name)
      .replace(/\\/g, "\\\\")}${Str.FG_DEFAULT}' or one of these:`;
    return hint;
  } catch (e) {
    throw e;
  }
};
const NOT_SERVICE_GROUP_CONTEXT = upOrg;
const ORGANIZATION_CONTEXT = downOrg;
const NOT_ORGANIZATION_CONTEXT = async (cmd: string) => {
  try {
    const struct = await fetchOrgRaw();
    let hint = `You can only run '${cmd}' from outside an organization.`;
    hint += `\nUse '${COMMAND_COLOR}cd ${struct.pathToRoot!.replace(
      /\\/g,
      "\\\\"
    )}..${Str.FG_DEFAULT}' or one of these:`;
    return hint;
  } catch (e) {
    throw e;
  }
};

export const CONTEXTS: { [cmd: string]: (cmd: string) => Promise<string> } = {
  clean: SERVICE_CONTEXT,
  build: SERVICE_CONTEXT,
  update: SERVICE_CONTEXT,
  upgrade: SERVICE_CONTEXT,
  deploy: SERVICE_CONTEXT,
  envvar: SERVICE_GROUP_CONTEXT,
  event: ORGANIZATION_CONTEXT,
  fetch: NOT_SERVICE_CONTEXT,
  group: NOT_SERVICE_GROUP_CONTEXT,
  hosting: NOT_SERVICE_GROUP_CONTEXT,
  join: NOT_ORGANIZATION_CONTEXT,
  key: ORGANIZATION_CONTEXT,
  org: NOT_ORGANIZATION_CONTEXT,
  start: NOT_ORGANIZATION_CONTEXT,
  rapids: ORGANIZATION_CONTEXT,
  rename: NOT_SERVICE_GROUP_CONTEXT,
  repo: SERVICE_GROUP_CONTEXT,
  role: NOT_SERVICE_GROUP_CONTEXT,
};
