"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTEXTS = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prompt_1 = require("./prompt");
const utils_1 = require("./utils");
function downOrg(cmd) {
    const folders = fs_1.default.readdirSync(".");
    let org = undefined;
    for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        if (fs_1.default.existsSync(path_1.default.join(folder, ".merrymake"))) {
            org = folder;
            break;
        }
    }
    let hint = `You can only run '${cmd}' from inside an organization.`;
    if (org !== undefined) {
        hint += `\nUse: '${prompt_1.GREEN}cd ${org}${prompt_1.NORMAL_COLOR}' or one of these:`;
    }
    else {
        hint += `\nUse one of these:`;
    }
    return hint;
}
function upOrg(cmd) {
    const struct = (0, utils_1.fetchOrgRaw)();
    if (struct.org === null)
        return downOrg(cmd);
    else {
        let hint = `You can only run '${cmd}' from the organization root folder.`;
        hint += `\nUse '${prompt_1.GREEN}cd ${struct.pathToRoot.substring(0, struct.pathToRoot.length - 1)}${prompt_1.NORMAL_COLOR}' or one of these:`;
        return hint;
    }
}
const SERVICE_CONTEXT = (cmd) => {
    let hint = `You can only run '${cmd}' from inside a service folder.`;
    const bfs = ["."];
    while (bfs.length !== 0) {
        const cur = bfs.shift();
        if (fs_1.default.existsSync(path_1.default.join(cur, "merrymake.json"))) {
            hint += `\nUse '${prompt_1.GREEN}cd ${cur.replace(/\\/g, "\\\\")}${prompt_1.NORMAL_COLOR}' or one of these:`;
            break;
        }
        else {
            try {
                if (fs_1.default.lstatSync(cur).isDirectory())
                    bfs.push(...fs_1.default.readdirSync(cur).map((x) => path_1.default.join(cur, x)));
            }
            catch (e) { }
        }
    }
    return hint;
};
const NOT_SERVICE_CONTEXT = (cmd) => {
    let hint = `You cannot run '${cmd}' from inside a service folder.`;
    hint += `\nUse '${prompt_1.GREEN}cd ..${prompt_1.NORMAL_COLOR}' or one of these:`;
    return hint;
};
const SERVICE_GROUP_CONTEXT = (cmd) => {
    const struct = (0, utils_1.fetchOrgRaw)();
    const serviceGroups = (0, utils_1.directoryNames)(new utils_1.Path(struct.pathToRoot), [
        "event-catalogue",
        "public",
    ]);
    let hint = `You can only run '${cmd}' from inside a service group.`;
    hint += `\nUse '${prompt_1.GREEN}cd ${path_1.default
        .join(struct.pathToRoot, serviceGroups[0].name)
        .replace(/\\/g, "\\\\")}${prompt_1.NORMAL_COLOR}' or one of these:`;
    return hint;
};
const NOT_SERVICE_GROUP_CONTEXT = upOrg;
const ORGANIZATION_CONTEXT = downOrg;
const NOT_ORGANIZATION_CONTEXT = (cmd) => {
    const struct = (0, utils_1.fetchOrgRaw)();
    let hint = `You can only run '${cmd}' from outside an organization.`;
    hint += `\nUse '${prompt_1.GREEN}cd ${struct.pathToRoot.replace(/\\/g, "\\\\")}..${prompt_1.NORMAL_COLOR}' or one of these:`;
    return hint;
};
exports.CONTEXTS = {
    rapids: ORGANIZATION_CONTEXT,
    role: ORGANIZATION_CONTEXT,
    deploy: SERVICE_CONTEXT,
    fetch: NOT_SERVICE_CONTEXT,
    repo: SERVICE_GROUP_CONTEXT,
    envvar: SERVICE_GROUP_CONTEXT,
    group: NOT_SERVICE_GROUP_CONTEXT,
    key: ORGANIZATION_CONTEXT,
    event: ORGANIZATION_CONTEXT,
    org: NOT_ORGANIZATION_CONTEXT,
    clone: NOT_ORGANIZATION_CONTEXT,
    join: NOT_ORGANIZATION_CONTEXT,
};
