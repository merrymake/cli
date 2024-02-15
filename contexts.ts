import fs from "fs";
import { GREEN, NORMAL_COLOR, YELLOW } from "./prompt";
import { Path, directoryNames, fetchOrg, fetchOrgRaw } from "./utils";
import path from "path";

function downOrg(cmd: string) {
  let folders = fs.readdirSync(".");
  let org = undefined;
  for (let i = 0; i < folders.length; i++) {
    let folder = folders[i];
    if (fs.existsSync(path.join(folder, ".merrymake"))) {
      org = folder;
      break;
    }
  }
  let hint = `You can only run '${cmd}' from inside an organization.`;
  if (org !== undefined) {
    hint += `\nUse: '${GREEN}cd ${org}${NORMAL_COLOR}' or one of these:`;
  } else {
    hint += `\nUse one of these:`;
  }
  return hint;
}
function upOrg(cmd: string) {
  let struct = fetchOrgRaw();
  if (struct.org === null) return downOrg(cmd);
  else {
    let hint = `You can only run '${cmd}' from the organization root folder.`;
    hint += `\nUse '${GREEN}cd ${struct.pathToRoot.substring(
      0,
      struct.pathToRoot.length - 1
    )}${NORMAL_COLOR}' or one of these:`;
    return hint;
  }
}

const SERVICE_CONTEXT = (cmd: string) => {
  let hint = `You can only run '${cmd}' from inside a service folder.`;
  let bfs = ["."];
  while (bfs.length !== 0) {
    let cur = bfs.shift()!;
    if (fs.existsSync(path.join(cur, "merrymake.json"))) {
      hint += `\nUse '${GREEN}cd ${cur.replace(
        /\\/g,
        "\\\\"
      )}${NORMAL_COLOR}' or one of these:`;
      break;
    } else {
      try {
        if (fs.lstatSync(cur).isDirectory())
          bfs.push(...fs.readdirSync(cur).map((x) => path.join(cur, x)));
      } catch (e) {}
    }
  }
  return hint;
};
const NOT_SERVICE_CONTEXT = (cmd: string) => {
  let hint = `You cannot run '${cmd}' from inside a service folder.`;
  hint += `\nUse '${GREEN}cd ..${NORMAL_COLOR}' or one of these:`;
  return hint;
};
const SERVICE_GROUP_CONTEXT = (cmd: string) => {
  let serviceGroups = directoryNames(new Path(), ["event-catalogue", "public"]);
  let hint = `You can only run '${cmd}' from inside a service group.`;
  hint += `\nUse '${GREEN}cd ${serviceGroups[0]}${NORMAL_COLOR}' or one of these:`;
  return hint;
};
const NOT_SERVICE_GROUP_CONTEXT = upOrg;
const ORGANIZATION_CONTEXT = downOrg;
const NOT_ORGANIZATION_CONTEXT = (cmd: string) => {
  let struct = fetchOrgRaw();
  let hint = `You can only run '${cmd}' from outside an organization.`;
  hint += `\nUse '${GREEN}cd ${struct.pathToRoot!.replace(
    /\\/g,
    "\\\\"
  )}..${NORMAL_COLOR}' or one of these:`;
  return hint;
};

export const CONTEXTS: { [cmd: string]: (cmd: string) => string } = {
  sim: ORGANIZATION_CONTEXT,
  queue: ORGANIZATION_CONTEXT,
  deploy: SERVICE_CONTEXT,
  redeploy: SERVICE_CONTEXT,
  fetch: NOT_SERVICE_CONTEXT,
  repo: SERVICE_GROUP_CONTEXT,
  build: SERVICE_CONTEXT,
  envvar: SERVICE_GROUP_CONTEXT,
  group: NOT_SERVICE_GROUP_CONTEXT,
  cron: ORGANIZATION_CONTEXT,
  key: ORGANIZATION_CONTEXT,
  post: ORGANIZATION_CONTEXT,
  event: ORGANIZATION_CONTEXT,
  quickstart: NOT_ORGANIZATION_CONTEXT,
  org: NOT_ORGANIZATION_CONTEXT,
  clone: NOT_ORGANIZATION_CONTEXT,
};
