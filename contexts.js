import fs from "fs";
import path from "path";
import { GREEN, NORMAL_COLOR } from "./prompt.js";
import { Path, directoryNames, fetchOrgRaw } from "./utils.js";
function downOrg(cmd) {
    const folders = fs.readdirSync(".");
    let org = undefined;
    for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        if (fs.existsSync(path.join(folder, ".merrymake"))) {
            org = folder;
            break;
        }
    }
    let hint = `You can only run '${cmd}' from inside an organization.`;
    if (org !== undefined) {
        hint += `\nUse: '${GREEN}cd ${org}${NORMAL_COLOR}' or one of these:`;
    }
    else {
        hint += `\nUse one of these:`;
    }
    return hint;
}
function upOrg(cmd) {
    const struct = fetchOrgRaw();
    if (struct.org === null)
        return downOrg(cmd);
    else {
        let hint = `You can only run '${cmd}' from the organization root folder.`;
        hint += `\nUse '${GREEN}cd ${struct.pathToRoot.substring(0, struct.pathToRoot.length - 1)}${NORMAL_COLOR}' or one of these:`;
        return hint;
    }
}
const SERVICE_CONTEXT = (cmd) => {
    let hint = `You can only run '${cmd}' from inside a service folder.`;
    const bfs = ["."];
    while (bfs.length !== 0) {
        const cur = bfs.shift();
        if (fs.existsSync(path.join(cur, "merrymake.json"))) {
            hint += `\nUse '${GREEN}cd ${cur.replace(/\\/g, "\\\\")}${NORMAL_COLOR}' or one of these:`;
            break;
        }
        else {
            try {
                if (fs.lstatSync(cur).isDirectory())
                    bfs.push(...fs.readdirSync(cur).map((x) => path.join(cur, x)));
            }
            catch (e) { }
        }
    }
    return hint;
};
const NOT_SERVICE_CONTEXT = (cmd) => {
    let hint = `You cannot run '${cmd}' from inside a service folder.`;
    hint += `\nUse '${GREEN}cd ..${NORMAL_COLOR}' or one of these:`;
    return hint;
};
const SERVICE_GROUP_CONTEXT = (cmd) => {
    const struct = fetchOrgRaw();
    const serviceGroups = directoryNames(new Path(struct.pathToRoot), [
        "event-catalogue",
        "public",
    ]);
    let hint = `You can only run '${cmd}' from inside a service group.`;
    hint += `\nUse '${GREEN}cd ${path
        .join(struct.pathToRoot, serviceGroups[0].name)
        .replace(/\\/g, "\\\\")}${NORMAL_COLOR}' or one of these:`;
    return hint;
};
const NOT_SERVICE_GROUP_CONTEXT = upOrg;
const ORGANIZATION_CONTEXT = downOrg;
const NOT_ORGANIZATION_CONTEXT = (cmd) => {
    const struct = fetchOrgRaw();
    let hint = `You can only run '${cmd}' from outside an organization.`;
    hint += `\nUse '${GREEN}cd ${struct.pathToRoot.replace(/\\/g, "\\\\")}..${NORMAL_COLOR}' or one of these:`;
    return hint;
};
export const CONTEXTS = {
    clone: NOT_ORGANIZATION_CONTEXT,
    clean: SERVICE_CONTEXT,
    build: SERVICE_CONTEXT,
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
