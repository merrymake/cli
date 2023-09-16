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
exports.do_cron = exports.do_envvar = exports.do_key = exports.do_inspect = exports.do_build = exports.do_redeploy = exports.do_deploy = exports.generateNewKey = exports.useExistingKey = exports.do_register = exports.fetch_template = exports.createService = exports.createServiceGroup = exports.createOrganization = exports.do_clone = exports.do_fetch = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("./utils");
const config_1 = require("./config");
const project_type_detect_1 = require("@mist-cloud-eu/project-type-detect");
const child_process_1 = require("child_process");
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
            yield fetch(org.pathToRoot, org.org.name, structure);
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
        let reply = yield (0, utils_1.sshReq)(`clone`, name);
        if (!reply.startsWith("{")) {
            (0, utils_1.output2)(reply);
            return;
        }
        let structure = JSON.parse(reply);
        yield clone(structure, name);
    });
}
exports.do_clone = do_clone;
function createOrganization(name) {
    return __awaiter(this, void 0, void 0, function* () {
        let reply = yield (0, utils_1.sshReq)(`org`, name);
        if (!reply.startsWith("{")) {
            (0, utils_1.output2)(reply);
            return;
        }
        let structure = JSON.parse(reply);
        yield clone(structure, name);
    });
}
exports.createOrganization = createOrganization;
function createServiceGroup(pth, name) {
    return __awaiter(this, void 0, void 0, function* () {
        let before = process.cwd();
        process.chdir(pth.toString());
        console.log("Creating service group...");
        let { org } = (0, utils_1.fetchOrg)();
        fs_1.default.mkdirSync(name);
        yield (0, utils_1.sshReq)(`team`, name, `--org`, org.name);
        process.chdir(before);
    });
}
exports.createServiceGroup = createServiceGroup;
function createService(pth, group, name) {
    return __awaiter(this, void 0, void 0, function* () {
        let before = process.cwd();
        process.chdir(pth.toString());
        console.log("Creating service...");
        let { org } = (0, utils_1.fetchOrg)();
        yield (0, utils_1.sshReq)(`service`, name, `--team`, group, `--org`, org.name);
        let repoBase = `${config_1.GIT_HOST}/${org.name}/${group}`;
        yield (0, utils_1.execPromise)(`git clone -q "${repoBase}/${name}" ${name}`);
        console.log(`Use 'cd ${pth.with(name).toString().replace(/\\/g, "\\\\")}' to go there`);
        process.chdir(before);
    });
}
exports.createService = createService;
function fetch_template(path, template, language) {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO
        console.log("Fetching template...");
        // await execPromise(`git pull -q "${repoBase}/${this.name}" ${name}`);
    });
}
exports.fetch_template = fetch_template;
function do_register(keyAction, email) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
exports.do_register = do_register;
function useExistingKey(path) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Reading ${path}.pub`);
        return "" + fs_1.default.readFileSync(os_1.default.homedir() + `/.ssh/${path}.pub`);
    });
}
exports.useExistingKey = useExistingKey;
function generateNewKey() {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
exports.generateNewKey = generateNewKey;
function deploy_internal(commit) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, utils_1.execStreamPromise)(`git add -A && ${commit} && git push origin HEAD 2>&1`, utils_1.output2);
    });
}
function do_deploy() {
    return __awaiter(this, void 0, void 0, function* () {
        deploy_internal("(git diff-index --quiet HEAD || git commit -m 'Deploy')");
    });
}
exports.do_deploy = do_deploy;
function do_redeploy() {
    return __awaiter(this, void 0, void 0, function* () {
        deploy_internal("git commit --allow-empty -m 'Redeploy'");
    });
}
exports.do_redeploy = do_redeploy;
function do_build() {
    return __awaiter(this, void 0, void 0, function* () {
        let projectType = (0, project_type_detect_1.detectProjectType)(".");
        project_type_detect_1.BUILD_SCRIPT_MAKERS[projectType](".").forEach((x) => {
            let [cmd, ...args] = x.split(" ");
            const options = {
                shell: "sh",
            };
            if (process.env["DEBUG"])
                console.log(cmd, args);
            (0, utils_1.output2)(`Building ${projectType} project...`);
            let ls = (0, child_process_1.spawn)(cmd, args, options);
            ls.stdout.on("data", (data) => {
                (0, utils_1.output2)(data.toString());
            });
            ls.stderr.on("data", (data) => {
                (0, utils_1.output2)(data.toString());
            });
        });
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
        let call = yield (0, utils_1.sshReq)(`cron`, name, overwrite, event, `--expr`, expr, `--org`, org);
        if (expr === "") {
            (0, utils_1.output2)(call);
        }
        else {
            let { s, n } = JSON.parse(call);
            (0, utils_1.output2)(`Cron '${s}' set to run next time at ${new Date(n).toLocaleString()}`);
        }
    });
}
exports.do_cron = do_cron;
