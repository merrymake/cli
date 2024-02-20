"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.do_spending = exports.do_remove_auto_approve = exports.do_auto_approve = exports.do_attach_role = exports.do_join = exports.do_post = exports.do_help = exports.do_queue_time = exports.printTableHeader = exports.alignLeft = exports.alignRight = exports.do_cron = exports.do_event = exports.do_envvar = exports.do_key = exports.do_inspect = exports.do_build = exports.do_redeploy = exports.do_deploy = exports.generateNewKey = exports.useExistingKey = exports.do_register = exports.addKnownHost = exports.do_duplicate = exports.fetch_template = exports.createService = exports.createServiceGroup = exports.createOrganization = exports.do_clone = exports.do_fetch = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("./utils");
const config_1 = require("./config");
const detect_project_type_1 = require("@merrymake/detect-project-type");
const child_process_1 = require("child_process");
const prompt_1 = require("./prompt");
const args_1 = require("./args");
const process_1 = require("process");
function clone(struct, name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(`Cloning ${name}...`);
            fs_1.default.mkdirSync(`${name}/.merrymake`, { recursive: true });
            let orgFile = { name };
            fs_1.default.writeFileSync(`${name}/.merrymake/conf.json`, JSON.stringify(orgFile));
            yield (0, utils_1.execPromise)(`git clone --branch main -q "${config_1.GIT_HOST}/${name}/event-catalogue" event-catalogue`, name);
            let dir = `${name}/public`;
            fs_1.default.mkdirSync(dir, { recursive: true });
            yield (0, utils_1.execPromise)(`git init --initial-branch=main`, dir);
            yield (0, utils_1.execPromise)(`git remote add origin "${config_1.GIT_HOST}/${name}/public"`, dir);
            // await execPromise(`git fetch`, dir);
            fetch(`./${name}`, name, struct);
        }
        catch (e) {
            throw e;
        }
    });
}
function fetch(prefix, org, struct) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let keys = Object.keys(struct);
            for (let i = 0; i < keys.length; i++) {
                let group = keys[i];
                fs_1.default.mkdirSync(`${prefix}/${group}`, { recursive: true });
                yield createFolderStructure(struct[group], `${prefix}/${group}`, org, group);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
function do_fetch() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let org = (0, utils_1.fetchOrg)();
            let reply = yield (0, utils_1.sshReq)(`clone`, org.org.name);
            if (!reply.startsWith("{")) {
                (0, utils_1.output2)(reply);
                return;
            }
            (0, utils_1.output2)(`Fetching...`);
            let structure = JSON.parse(reply);
            yield fetch(org.pathToRoot, org.org.name, structure);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_fetch = do_fetch;
function createFolderStructure(struct, prefix, org, team) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let keys = Object.keys(struct);
            for (let i = 0; i < keys.length; i++) {
                let k = keys[i];
                if (struct[k] instanceof Object)
                    yield createFolderStructure(struct[k], prefix + "/" + k, org, team);
                else {
                    // output(`git clone "${HOST}/${org}/${team}/${k}" "${prefix}/${k}"`);
                    let repo = `"${config_1.GIT_HOST}/${org}/${team}/${k}"`;
                    let dir = `${prefix}/${k}`;
                    try {
                        if (!fs_1.default.existsSync(dir)) {
                            fs_1.default.mkdirSync(dir, { recursive: true });
                        }
                        if (!fs_1.default.existsSync(dir + "/.git")) {
                            (0, utils_1.output2)("Here1 " + dir);
                            yield (0, utils_1.execPromise)(`git init --initial-branch=main`, dir);
                            (0, utils_1.output2)("Here2 " + dir);
                            yield (0, utils_1.execPromise)(`git remote add origin ${repo}`, dir);
                            (0, utils_1.output2)("Here3 " + dir);
                            fs_1.default.writeFileSync(dir + "/fetch.bat", `@echo off
git fetch
git reset --hard origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`);
                            fs_1.default.writeFileSync(dir + "/fetch.sh", `#!/bin/sh
git fetch
git reset --hard origin/main
rm fetch.bat fetch.sh`);
                        }
                        else {
                            yield (0, utils_1.execPromise)(`git remote set-url origin ${repo}`, dir);
                        }
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
            }
        }
        catch (e) {
            throw e;
        }
    });
}
function do_clone(name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let reply = yield (0, utils_1.sshReq)(`clone`, name);
            if (!reply.startsWith("{")) {
                (0, utils_1.output2)(reply);
                return;
            }
            let structure = JSON.parse(reply);
            yield clone(structure, name);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_clone = do_clone;
function createOrganization(name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let reply = yield (0, utils_1.sshReq)(`org`, name);
            if (!reply.startsWith("{")) {
                (0, utils_1.output2)(reply);
                return;
            }
            let structure = JSON.parse(reply);
            yield clone(structure, name);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.createOrganization = createOrganization;
function createServiceGroup(pth, name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let before = process.cwd();
            process.chdir(pth.toString());
            console.log("Creating service group...");
            let { org } = (0, utils_1.fetchOrg)();
            fs_1.default.mkdirSync(name);
            yield (0, utils_1.sshReq)(`team`, name, `--org`, org.name);
            process.chdir(before);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.createServiceGroup = createServiceGroup;
function createService(pth, group, name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let before = process.cwd();
            process.chdir(pth.toString());
            console.log("Creating service...");
            let { org } = (0, utils_1.fetchOrg)();
            yield (0, utils_1.sshReq)(`service`, name, `--team`, group, `--org`, org.name);
            let repoBase = `${config_1.GIT_HOST}/${org.name}/${group}`;
            try {
                yield (0, utils_1.execPromise)(`git clone -q "${repoBase}/${name}" ${name}`);
            }
            catch (e) {
                if (("" + e).startsWith("warning: You appear to have cloned an empty repository.")) {
                }
                else
                    throw e;
            }
            yield (0, utils_1.execPromise)(`git symbolic-ref HEAD refs/heads/main`, name);
            (0, utils_1.addExitMessage)(`Use '${prompt_1.GREEN}cd ${pth
                .with(name)
                .toString()
                .replace(/\\/g, "\\\\")}${prompt_1.NORMAL_COLOR}' to go to the new service. \nThen use '${prompt_1.GREEN}${process.env["COMMAND"]} deploy${prompt_1.NORMAL_COLOR}' to deploy it.`);
            process.chdir(before);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.createService = createService;
function do_pull(pth, repo) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let before = process.cwd();
            process.chdir(pth.toString());
            yield (0, utils_1.execPromise)(`git pull -q "${repo}"`);
            process.chdir(before);
        }
        catch (e) {
            throw e;
        }
    });
}
function fetch_template(pth, template, projectType) {
    console.log("Fetching template...");
    return do_pull(pth, `https://github.com/merrymake/${projectType}-${template}-template`);
}
exports.fetch_template = fetch_template;
function do_duplicate(pth, org, group, service) {
    console.log("Duplicating service...");
    return do_pull(pth, `${config_1.GIT_HOST}/${org}/${group}/${service}`);
}
exports.do_duplicate = do_duplicate;
function addKnownHost() {
    let isKnownHost = false;
    if (fs_1.default.existsSync(`${os_1.default.homedir()}/.ssh/known_hosts`)) {
        let lines = ("" + fs_1.default.readFileSync(`${os_1.default.homedir()}/.ssh/known_hosts`)).split("\n");
        isKnownHost = lines.some((x) => x.includes(`${config_1.API_URL} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO`));
    }
    if (!isKnownHost) {
        console.log("Adding fingerprint...");
        fs_1.default.appendFileSync(`${os_1.default.homedir()}/.ssh/known_hosts`, `\n${config_1.API_URL} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO\n`);
    }
}
exports.addKnownHost = addKnownHost;
function do_register(keyAction, email) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let { key, keyFile } = yield keyAction();
            console.log("Registering...");
            addKnownHost();
            if (email === "") {
                (0, utils_1.addExitMessage)(`Notice: Anonymous accounts are automatically deleted permanently after ~2 weeks, without warning. To add an email and avoid automatic deletion, run the command:
  ${prompt_1.YELLOW}${process.env["COMMAND"]} register ${keyFile}${prompt_1.NORMAL_COLOR}`);
            }
            let result = yield (0, utils_1.urlReq)(`${config_1.HTTP_HOST}/admin/user`, "POST", JSON.stringify({
                email,
                key,
            }));
            if (/^\d+$/.test(result.body)) {
                (0, utils_1.saveCache)({ registered: true, hasOrgs: +result.body > 0 });
                (0, utils_1.output2)("Registered user.");
            }
            else {
                if (result.code === 200) {
                    (0, utils_1.saveCache)({ registered: true, hasOrgs: false });
                }
                (0, utils_1.output2)(result.body);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_register = do_register;
function saveSSHConfig(path) {
    let lines = [];
    let changed = false;
    let foundHost = false;
    if (fs_1.default.existsSync(`${os_1.default.homedir()}/.ssh/config`)) {
        lines = fs_1.default
            .readFileSync(`${os_1.default.homedir()}/.ssh/config`)
            .toString()
            .split("\n");
        let inHost = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if ((line.startsWith("\t") || line.startsWith(" ")) && inHost) {
                if (line.includes("User ")) {
                    lines[i] =
                        line.substring(0, line.indexOf("User ")) + `User ${config_1.SSH_USER}`;
                    changed = true;
                }
                else if (line.includes("IdentityFile ")) {
                    lines[i] =
                        line.substring(0, line.indexOf("IdentityFile ")) +
                            `IdentityFile ~/.ssh/${path}`;
                    changed = true;
                }
            }
            else if (line.startsWith("\t") || line.startsWith(" ")) {
            }
            else if (line.startsWith(`Host ${config_1.API_URL}`)) {
                inHost = true;
                foundHost = true;
            }
            else {
                inHost = false;
            }
        }
    }
    if (!foundHost) {
        lines.unshift(`Host ${config_1.API_URL}`, `\tUser ${config_1.SSH_USER}`, `\tHostName ${config_1.API_URL}`, `\tPreferredAuthentications publickey`, `\tIdentityFile ~/.ssh/${path}\n`);
        changed = true;
    }
    if (changed) {
        console.log(`Saving preference...`);
        fs_1.default.writeFileSync(`${os_1.default.homedir()}/.ssh/config`, lines.join("\n"));
    }
}
function useExistingKey(path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            saveSSHConfig(path);
            console.log(`Reading ${path}.pub...`);
            return {
                key: "" + fs_1.default.readFileSync(os_1.default.homedir() + `/.ssh/${path}.pub`),
                keyFile: path,
            };
        }
        catch (e) {
            throw e;
        }
    });
}
exports.useExistingKey = useExistingKey;
function generateNewKey() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`Generating new ssh key...`);
            if (!fs_1.default.existsSync(os_1.default.homedir() + "/.ssh"))
                fs_1.default.mkdirSync(os_1.default.homedir() + "/.ssh");
            yield (0, utils_1.execPromise)(`ssh-keygen -t rsa -b 4096 -f "${os_1.default.homedir()}/.ssh/merrymake" -N ""`);
            saveSSHConfig("merrymake");
            return {
                key: "" + fs_1.default.readFileSync(os_1.default.homedir() + "/.ssh/merrymake.pub"),
                keyFile: "merrymake",
            };
        }
        catch (e) {
            throw e;
        }
    });
}
exports.generateNewKey = generateNewKey;
function deploy_internal(commit) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, utils_1.execStreamPromise)(`git add -A && ${commit} && git push origin HEAD 2>&1`, utils_1.output2);
        }
        catch (e) {
            throw e;
        }
    });
}
function do_deploy(pathToService) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let before = process.cwd();
            process.chdir(pathToService.toString());
            yield deploy_internal("(git diff-index --quiet HEAD || git commit -m 'Deploy')");
            process.chdir(before);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_deploy = do_deploy;
function do_redeploy() {
    return deploy_internal("git commit --allow-empty -m 'Redeploy'");
}
exports.do_redeploy = do_redeploy;
function spawnPromise(str) {
    return new Promise((resolve, reject) => {
        let [cmd, ...args] = str.split(" ");
        const options = {
            cwd: ".",
            shell: "sh",
        };
        let ls = (0, child_process_1.spawn)(cmd, args, options);
        ls.stdout.on("data", (data) => {
            (0, utils_1.output2)(data.toString());
        });
        ls.stderr.on("data", (data) => {
            (0, utils_1.output2)(data.toString());
        });
        ls.on("close", (code) => {
            if (code === 0)
                resolve();
            else
                reject();
        });
    });
}
function do_build() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let projectType = (0, detect_project_type_1.detectProjectType)(".");
            (0, utils_1.output2)(`Building ${projectType} project...`);
            let buildCommands = detect_project_type_1.BUILD_SCRIPT_MAKERS[projectType](".");
            for (let i = 0; i < buildCommands.length; i++) {
                let x = buildCommands[i];
                yield spawnPromise(x);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_build = do_build;
function do_inspect(org, id, river) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let res = JSON.parse(yield (0, utils_1.sshReq)(`inspect`, id, `--river`, river, `--org`, `${org}`));
            let resout = res.output;
            delete res.output;
            console.log(res);
            (0, utils_1.output2)("Output:");
            (0, utils_1.output2)(resout);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_inspect = do_inspect;
function do_key(org, key, name, duration) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let cmd = [`key`, duration, `--org`, org];
            if (name !== "")
                cmd.push(`--name`, name);
            if (key === null) {
                let { key, expiry } = JSON.parse(yield (0, utils_1.sshReq)(...cmd));
                (0, utils_1.output2)(`${key} expires on ${new Date(expiry).toLocaleString()}.`);
                (0, utils_1.addExitMessage)(`Key: ${prompt_1.GREEN}${key}${prompt_1.NORMAL_COLOR}`);
            }
            else {
                cmd.push(`--update`, key);
                let { count, expiry } = JSON.parse(yield (0, utils_1.sshReq)(...cmd));
                (0, utils_1.output2)(`Updated ${count} keys to expire on ${new Date(expiry).toLocaleString()}.`);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_key = do_key;
function do_envvar(org, group, overwrite, key, value, access, visibility) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`secret`, key, overwrite, ...access, `--org`, org, `--team`, group, `--value`, value, visibility));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_envvar = do_envvar;
function do_event(org, key, event, create) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`event`, event, `--key`, key, ...(create ? [] : [`--delete`])));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_event = do_event;
function do_cron(org, name, overwrite, event, expr) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let call = yield (0, utils_1.sshReq)(`cron`, name, overwrite, event, `--expr`, expr, `--org`, org);
            if (expr === "") {
                (0, utils_1.output2)(call);
            }
            else {
                let { s, n } = JSON.parse(call);
                (0, utils_1.output2)(`Cron '${s}' set to run next time at ${new Date(n).toLocaleString()}`);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_cron = do_cron;
function alignRight(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padStart(width, " ");
}
exports.alignRight = alignRight;
function alignLeft(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padEnd(width, " ");
}
exports.alignLeft = alignLeft;
function printTableHeader(prefix, widths) {
    if ((0, args_1.getArgs)().length > 0)
        return;
    let totalWidth = process_1.stdout.getWindowSize()[0] - prefix.length;
    let vals = Object.values(widths);
    let rest = totalWidth -
        vals.reduce((acc, x) => acc + Math.max(x, 0)) -
        3 * (vals.length - 1);
    let header = prefix +
        Object.keys(widths)
            .map((k) => k.trim().padEnd(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k]))
            .join(" │ ");
    (0, utils_1.output2)(header);
    let divider = prefix +
        Object.keys(widths)
            .map((k) => "─".repeat(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k]))
            .join("─┼─");
    (0, utils_1.output2)(divider);
}
exports.printTableHeader = printTableHeader;
function do_queue_time(org, time) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`queue`, `--org`, org, `--time`, "" + time);
            let queue = JSON.parse(resp);
            printTableHeader("", {
                Id: 6,
                River: 12,
                Event: 12,
                Status: 7,
                "Queue time": 20,
            });
            queue.forEach((x) => (0, utils_1.output2)(`${x.id} │ ${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${alignLeft(x.s, 7)} │ ${new Date(x.q).toLocaleString()}`));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_queue_time = do_queue_time;
function do_help() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, utils_1.urlReq)("https://google.com");
        }
        catch (e) {
            (0, utils_1.output2)(`${prompt_1.RED}No internet connection.${prompt_1.NORMAL_COLOR}`);
            return;
        }
        let whoami = JSON.parse(yield (0, utils_1.sshReq)("whoami"));
        if (whoami === undefined || whoami.length === 0) {
            let cache = (0, utils_1.getCache)();
            if (!cache.registered) {
                (0, utils_1.output2)(`${prompt_1.YELLOW}No key registered with ${process.env["COMMAND"]}.${prompt_1.NORMAL_COLOR}`);
            }
            (0, utils_1.output2)(`${prompt_1.RED}No verified email.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Logged in as: ${whoami.join(", ")}.${prompt_1.NORMAL_COLOR}`);
        }
        let rawStruct = (0, utils_1.fetchOrgRaw)();
        if (rawStruct.org === null) {
            (0, utils_1.output2)(`${prompt_1.YELLOW}Not inside organization.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Inside organization: ${rawStruct.org.name}${prompt_1.NORMAL_COLOR}`);
        }
        if (rawStruct.serviceGroup === null) {
            (0, utils_1.output2)(`${prompt_1.YELLOW}Not inside service group.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Inside service group: ${rawStruct.serviceGroup}${prompt_1.NORMAL_COLOR}`);
        }
        if (!fs_1.default.existsSync("mist.json") && !fs_1.default.existsSync("merrymake.json")) {
            (0, utils_1.output2)(`${prompt_1.YELLOW}Not inside service repo.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Inside service repo.${prompt_1.NORMAL_COLOR}`);
        }
    });
}
exports.do_help = do_help;
function do_post(eventType, key, contentType, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.urlReq)(`${config_1.RAPIDS_HOST}/${key}/${eventType}`, "POST", payload, contentType);
            (0, utils_1.output2)(resp.body);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_post = do_post;
function do_join(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`org`, `--join`, org));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_join = do_join;
function do_attach_role(org, user, role) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`role`, `--user`, user, `--org`, org, role));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_attach_role = do_attach_role;
function do_auto_approve(org, domain, role) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`preapprove`, `--add`, role, `--org`, org, domain));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_auto_approve = do_auto_approve;
function do_remove_auto_approve(org, domain) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`preapprove`, `--org`, org, domain));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_remove_auto_approve = do_remove_auto_approve;
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
function do_spending(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let rows = JSON.parse(yield (0, utils_1.sshReq)(`spending`, `--org`, org));
            let mth = 0;
            let grp = "";
            let srv = "";
            rows.forEach((x) => {
                if (x.mth === null)
                    return;
                if (mth !== x.mth) {
                    if (mth !== 0)
                        (0, utils_1.output2)("");
                    mth = x.mth;
                    (0, utils_1.output2)(`Month: ${MONTHS[x.mth - 1]}`);
                    printTableHeader("", {
                        Group: 11,
                        Service: 11,
                        Hook: 20,
                        Count: 7,
                        Time: 7,
                        "Est. Cost": 9,
                    });
                }
                let group = x.grp === null ? "= Total" : x.grp === grp ? "" : x.grp;
                grp = x.grp;
                let service = x.grp === null
                    ? ""
                    : x.srv === null
                        ? "= Total"
                        : x.srv === srv
                            ? ""
                            : x.srv;
                srv = x.srv;
                let count = x.cnt;
                let count_unit = " ";
                if (count > 1000) {
                    count /= 1000;
                    count_unit = "k";
                }
                if (count > 1000) {
                    count /= 1000;
                    count_unit = "M";
                }
                if (count > 1000) {
                    count /= 1000;
                    count_unit = "B";
                }
                let time = x.time_ms;
                let time_unit = "ms";
                if (time > 1000) {
                    time /= 1000;
                    time_unit = "s";
                }
                if (time > 60) {
                    time /= 60;
                    time_unit = "m";
                }
                if (time > 60) {
                    time /= 60;
                    time_unit = "h";
                }
                if (time > 24) {
                    time /= 24;
                    time_unit = "d";
                }
                if (time > 30) {
                    time /= 30;
                    time_unit = "M";
                }
                let hook = x.srv === null ? "" : x.hook === null ? "= Total" : x.hook;
                (0, utils_1.output2)(`${alignLeft(group, 11)} │ ${alignLeft(service, 11)} │ ${alignLeft(hook, 20)} │ ${alignRight("" + count.toFixed(1) + " " + count_unit, 7)} │ ${alignRight("" + time.toFixed(1) + " " + time_unit, 7)} │ € ${alignRight(x.cost_eur, 7)}`);
            });
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_spending = do_spending;
