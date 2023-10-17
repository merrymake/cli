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
exports.do_queue_time = exports.printTableHeader = exports.alignLeft = exports.alignRight = exports.do_cron = exports.do_envvar = exports.do_key = exports.do_inspect = exports.do_build = exports.do_redeploy = exports.do_deploy = exports.generateNewKey = exports.useExistingKey = exports.do_register = exports.do_duplicate = exports.fetch_template = exports.createService = exports.createServiceGroup = exports.createOrganization = exports.do_clone = exports.do_fetch = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("./utils");
const config_1 = require("./config");
const detect_project_type_1 = require("@merrymake/detect-project-type");
const child_process_1 = require("child_process");
const prompt_1 = require("./prompt");
const path_1 = __importDefault(require("path"));
function clone(struct, name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(`Cloning ${name}...`);
            fs_1.default.mkdirSync(`${name}/.merrymake`, { recursive: true });
            let orgFile = { name };
            fs_1.default.writeFileSync(`${name}/.merrymake/conf.json`, JSON.stringify(orgFile));
            yield (0, utils_1.execPromise)(`git clone -q "${config_1.GIT_HOST}/${name}/event-catalogue" event-catalogue`, name);
            fetch(".", name, struct);
        }
        catch (e) {
            throw e;
        }
    });
}
function fetch(prefix, org, struct) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            Object.keys(struct).forEach((team) => {
                fs_1.default.mkdirSync(`${prefix}/${org}/${team}`, { recursive: true });
                createFolderStructure(struct[team], `${prefix}/${org}/${team}`, org, team);
            });
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
            yield fetch(path_1.default.join(org.pathToRoot, ".."), org.org.name, structure);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_fetch = do_fetch;
function createFolderStructure(struct, prefix, org, team) {
    Object.keys(struct).forEach((k) => __awaiter(this, void 0, void 0, function* () {
        if (struct[k] instanceof Object)
            createFolderStructure(struct[k], prefix + "/" + k, org, team);
        else {
            // output(`git clone "${HOST}/${org}/${team}/${k}" "${prefix}/${k}"`);
            let repo = `"${config_1.GIT_HOST}/${org}/${team}/${k}"`;
            let dir = `${prefix}/${k}`;
            try {
                if (!fs_1.default.existsSync(dir)) {
                    fs_1.default.mkdirSync(dir, { recursive: true });
                    yield (0, utils_1.execPromise)(`git init --initial-branch=main`, dir);
                    yield (0, utils_1.execPromise)(`git remote add origin ${repo}`, dir);
                    yield fs_1.default.writeFile(dir + "/fetch.bat", `@echo off
git fetch
git reset --hard origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`, () => { });
                    yield fs_1.default.writeFile(dir + "/fetch.sh", `#!/bin/sh
git fetch
git reset --hard origin/main
rm fetch.bat fetch.sh`, () => { });
                }
            }
            catch (e) {
                console.log(e);
            }
        }
    }));
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
            (0, utils_1.addExitMessage)(`Use '${prompt_1.COLOR3}cd ${pth
                .with(name)
                .toString()
                .replace(/\\/g, "\\\\")}${prompt_1.NORMAL_COLOR}' to go to the new service. \nThen use '${prompt_1.COLOR3}${process.env["COMMAND"]} deploy${prompt_1.NORMAL_COLOR}' to deploy it.`);
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
function do_register(keyAction, email) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let key = yield keyAction();
            console.log("Registering...");
            fs_1.default.appendFileSync(`${os_1.default.homedir()}/.ssh/known_hosts`, "\napi.mist-cloud.io ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO\n");
            let result = yield (0, utils_1.urlReq)(`${config_1.HTTP_HOST}/admin/user`, "POST", {
                email,
                key,
            });
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
function useExistingKey(path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`Reading ${path}.pub`);
            return "" + fs_1.default.readFileSync(os_1.default.homedir() + `/.ssh/${path}.pub`);
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
            console.log(`Generating new ssh key`);
            if (!fs_1.default.existsSync(os_1.default.homedir() + "/.ssh"))
                fs_1.default.mkdirSync(os_1.default.homedir() + "/.ssh");
            yield (0, utils_1.execPromise)(`ssh-keygen -t rsa -b 4096 -f "${os_1.default.homedir()}/.ssh/merrymake" -N ""`);
            fs_1.default.appendFileSync(`${os_1.default.homedir()}/.ssh/config`, `\nHost api.mist-cloud.io
    User mist
    HostName api.mist-cloud.io
    PreferredAuthentications publickey
    IdentityFile ~/.ssh/merrymake\n`);
            return "" + fs_1.default.readFileSync(os_1.default.homedir() + "/.ssh/merrymake.pub");
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
                (0, utils_1.addExitMessage)(`Key: ${prompt_1.COLOR3}${key}${prompt_1.NORMAL_COLOR}`);
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
    let header = prefix +
        Object.keys(widths)
            .map((k) => k.trim().padEnd(widths[k]))
            .join(" │ ");
    (0, utils_1.output2)(header);
    let divider = prefix +
        Object.keys(widths)
            .map((k) => "─".repeat(widths[k]))
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
