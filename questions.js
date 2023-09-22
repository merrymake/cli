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
exports.start = void 0;
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const prompt_1 = require("./prompt");
const utils_1 = require("./utils");
const utils_2 = require("./utils");
const executors_1 = require("./executors");
const detect_project_type_1 = require("@merrymake/detect-project-type");
const templates_1 = require("./templates");
const simulator_1 = require("./simulator");
const args_1 = require("./args");
function service_template_language(path, template, projectType) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.fetch_template)(path, template, projectType));
    return (0, utils_1.finish)();
}
function register_key_email(keyAction, email) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_register)(keyAction, email));
    return (0, utils_1.finish)();
}
function deploy() {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_deploy)(new utils_2.Path()));
    return (0, utils_1.finish)();
}
function redeploy() {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_redeploy)());
    return (0, utils_1.finish)();
}
function build() {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_build)());
    return (0, utils_1.finish)();
}
function fetch() {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_fetch)());
    return (0, utils_1.finish)();
}
function service_template(pathToService, template) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let langs = yield Promise.all(templates_1.templates[template].languages.map((x) => (() => __awaiter(this, void 0, void 0, function* () {
                return (Object.assign(Object.assign({}, templates_1.languages[x]), { weight: yield (0, utils_1.execPromise)(detect_project_type_1.VERSION_CMD[templates_1.languages[x].projectType])
                        .then((x) => 10)
                        .catch((e) => 1) }));
            }))()));
            langs.sort((a, b) => b.weight - a.weight);
            return yield (0, prompt_1.choice)(langs.map((x) => ({
                long: x.long,
                short: x.short,
                text: x.long,
                action: () => service_template_language(pathToService, template, x.projectType),
            }))).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function duplicate_service_deploy(pathToService, org, group, service, deploy) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_duplicate)(pathToService, org, group, service));
        if (deploy)
            (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_deploy)(pathToService));
        return (0, utils_1.finish)();
    });
}
function duplicate_service(pathToService, org, group, service) {
    return (0, prompt_1.choice)([
        {
            long: "deploy",
            short: "d",
            text: "deploy the service immediately",
            action: () => duplicate_service_deploy(pathToService, org, group, service, true),
        },
        {
            long: "clone",
            short: "c",
            text: "only clone it, no deploy",
            action: () => duplicate_service_deploy(pathToService, org, group, service, false),
        },
    ]);
}
function duplicate(pathToService, org, group) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-services`, `--org`, org, `--team`, group);
            let repos = JSON.parse(resp);
            return yield (0, prompt_1.choice)(repos.map((x) => ({
                long: x,
                text: `${x}`,
                action: () => duplicate_service(pathToService, org, group, x),
            }))).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function service(pathToGroup, org, group) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let name = yield (0, prompt_1.shortText)("Repository name", "This is where the code lives.", "Merrymake").then((x) => x);
            (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createService)(pathToGroup, group, name));
            let options = [];
            let services = (0, utils_1.directoryNames)(pathToGroup, []);
            if (services.length > 0) {
                options.push({
                    long: "duplicate",
                    short: "d",
                    text: "duplicate an existing service",
                    action: () => duplicate(pathToGroup.with(name), org, group),
                });
            }
            Object.keys(templates_1.templates).forEach((x) => options.push({
                long: templates_1.templates[x].long,
                short: templates_1.templates[x].short,
                text: templates_1.templates[x].text,
                action: () => service_template(pathToGroup.with(name), x),
            }));
            options.push({
                long: "empty",
                short: "e",
                text: "just an empty repository",
                action: () => (0, utils_1.finish)(),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function group(path, org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let name = yield (0, prompt_1.shortText)("Service group name", "Used to share envvars.", "services").then((x) => x);
            (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createServiceGroup)(path, name));
            return service(path.with(name), org, name);
        }
        catch (e) {
            throw e;
        }
    });
}
function org() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let defName = "org" + ("" + Math.random()).substring(2);
            let name = yield (0, prompt_1.shortText)("Organization name", "Used when collaborating with others.", defName).then((x) => x);
            (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createOrganization)(name));
            return group(new utils_2.Path(name), name);
        }
        catch (e) {
            throw e;
        }
    });
}
function register_key(keyAction) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let email = yield (0, prompt_1.shortText)("Email", "By attaching an email you'll be notified in case of changes for your organizations.", "").then((x) => x);
            return register_key_email(keyAction, email);
        }
        catch (e) {
            throw e;
        }
    });
}
function register() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let keys = (0, utils_1.getFiles)(new utils_2.Path(`${os_1.default.homedir()}/.ssh`), "")
                .filter((x) => x.endsWith(".pub"))
                .map((x) => {
                let f = x.substring(0, x.length - ".pub".length);
                return {
                    long: f,
                    text: `Use key ${f}`,
                    action: () => register_key(() => (0, executors_1.useExistingKey)(f)),
                };
            });
            keys.push({
                long: "new",
                short: "n",
                text: "Setup new key specifically for Merrymake",
                action: () => register_key(executors_1.generateNewKey),
            });
            return yield (0, prompt_1.choice)(keys, true, keys.length - 1).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function checkout_org(org) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_clone)(org));
    return (0, utils_1.finish)();
}
function queue_event(org, id, river) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_inspect)(org, id, river));
    return (0, utils_1.finish)();
}
function checkout() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-organizations`);
            let orgs = JSON.parse(resp);
            return yield (0, prompt_1.choice)(orgs.map((x) => ({
                long: x,
                text: `checkout ${x}`,
                action: () => checkout_org(x),
            }))).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
let cache_queue;
function queue_id(org, id) {
    return (0, prompt_1.choice)(cache_queue
        .filter((x) => x.id === id)
        .map((x) => ({
        long: x.r,
        text: `${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${x.s} │ ${new Date(x.q).toLocaleString()}`,
        action: () => queue_event(org, x.id, x.r),
    })), false).then((x) => x);
}
function queue(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`queue`, `--org`, org);
            cache_queue = JSON.parse(resp);
            return yield (0, prompt_1.choice)(cache_queue.map((x) => ({
                long: x.id,
                text: `${x.id} │ ${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${x.s} │ ${new Date(x.q).toLocaleString()}`,
                action: () => {
                    if ((0, args_1.getArgs)().length === 0)
                        (0, args_1.initializeArgs)([x.r]);
                    return queue_id(org, x.id);
                },
            })), false).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function keys_key_name_duration(org, key, name, duration) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_key)(org, key, name, duration));
    return (0, utils_1.finish)();
}
function keys_key_name(org, key, name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let duration = yield (0, prompt_1.shortText)("Duration", "How long should the key be active? Ex. 1 hour", "14 days");
            return keys_key_name_duration(org, key, name, duration);
        }
        catch (e) {
            throw e;
        }
    });
}
function keys_key(org, key, currentName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let name = yield (0, prompt_1.shortText)("Human readable description", "Used to identify this key", currentName);
            return keys_key_name(org, key, name);
        }
        catch (e) {
            throw e;
        }
    });
}
function envvar_key_value_access_visible(org, group, overwrite, key, value, access, visibility) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_envvar)(org, group, overwrite, key, value, access, visibility));
    return (0, utils_1.finish)();
}
function envvar_key_value_access(org, group, overwrite, key, value, access) {
    return (0, prompt_1.choice)([
        {
            long: "secret",
            short: "s",
            text: "keep value secret",
            action: () => envvar_key_value_access_visible(org, group, overwrite, key, value, access, ""),
        },
        {
            long: "public",
            short: "p",
            text: "the value is public",
            action: () => envvar_key_value_access_visible(org, group, overwrite, key, value, access, "--public"),
        },
    ]);
}
function envvar_key_value(org, group, overwrite, key, value) {
    return (0, prompt_1.choice)([
        {
            long: "both",
            short: "b",
            text: "accessible in both prod and test",
            action: () => envvar_key_value_access(org, group, overwrite, key, value, [
                "--prod",
                "--test",
            ]),
        },
        {
            long: "prod",
            short: "p",
            text: "accessible in prod",
            action: () => envvar_key_value_access(org, group, overwrite, key, value, ["--prod"]),
        },
        {
            long: "test",
            short: "t",
            text: "accessible in test",
            action: () => envvar_key_value_access(org, group, overwrite, key, value, ["--test"]),
        },
    ]);
}
function envvar_key(org, group, overwrite, key, currentValue) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let value = yield (0, prompt_1.shortText)("Value", "The value...", currentValue);
            return envvar_key_value(org, group, overwrite, key, value);
        }
        catch (e) {
            throw e;
        }
    });
}
function alignRight(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padStart(width, " ");
}
function alignLeft(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padEnd(width, " ");
}
function keys(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-keys`, `--org`, org);
            let orgs = JSON.parse(resp);
            let options = orgs.map((x) => {
                let d = new Date(x.expiry);
                let ds = d.getTime() < Date.now()
                    ? `${prompt_1.COLOR1}${d.toLocaleString()}${prompt_1.NORMAL_COLOR}`
                    : d.toLocaleString();
                let n = x.name || "";
                return {
                    long: x.key,
                    text: `${x.key} │ ${alignLeft(n, 12)} │ ${ds}`,
                    action: () => keys_key(org, x.key, x.name),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => keys_key(org, null, ""),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function envvar_new(org, group) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let key = yield (0, prompt_1.shortText)("Key", "Key for the key-value pair", "key");
            return envvar_key(org, group, "", key, "");
        }
        catch (e) {
            throw e;
        }
    });
}
function envvar(org, group) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-secrets`, `--org`, org, `--team`, group);
            let orgs = JSON.parse(resp);
            let options = orgs.map((x) => ({
                long: x.key,
                text: `[${x.test ? "T" : " "}${x.prod ? "P" : " "}] ${x.key}: ${x.val}`,
                action: () => envvar_key(org, group, "--overwrite", x.key, x.val),
            }));
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new secret`,
                action: () => envvar_new(org, group),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function cron_name_event_expression(org, name, overwrite, event, expression) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_cron)(org, name, overwrite, event, expression));
    return (0, utils_1.finish)();
}
function cron_name_event(org, name, overwrite, event, currentExpression) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let expression = yield (0, prompt_1.shortText)("Cron expression", "Eg. every 5 minutes is '*/5 * * * *'", currentExpression);
            return cron_name_event_expression(org, name, overwrite, event, expression);
        }
        catch (e) {
            throw e;
        }
    });
}
function cron_name(org, name, currentEvent, expression) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let event = yield (0, prompt_1.shortText)("Which event to spawn", "Event that should be spawned", currentEvent);
            return cron_name_event(org, name, "--overwrite", event, expression);
        }
        catch (e) {
            throw e;
        }
    });
}
function cron_new_event(org, event) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let name = yield (0, prompt_1.shortText)("Unique name", "Used to edit or delete the cron job later", event);
            return cron_name_event(org, name, "", event, "");
        }
        catch (e) {
            throw e;
        }
    });
}
function cron_new(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let event = yield (0, prompt_1.shortText)("Which event to spawn", "Event that should be spawned", "event");
            return cron_new_event(org, event);
        }
        catch (e) {
            throw e;
        }
    });
}
function cron(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-crons`, `--org`, org);
            let orgs = JSON.parse(resp);
            let options = orgs.map((x) => ({
                long: x.name,
                text: `${alignRight(x.name, 10)} │ ${alignRight(x.event, 10)} │ ${x.expression}`,
                action: () => cron_name(org, x.name, x.event, x.expression),
            }));
            options.push({
                long: `new`,
                short: `n`,
                text: `setup a new cron job`,
                action: () => cron_new(org),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function quickstart() {
    let cache = (0, utils_1.getCache)();
    if (!cache.registered)
        (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_register)(executors_1.generateNewKey, ""));
    let orgName = "org" + ("" + Math.random()).substring(2);
    let pth = new utils_2.Path();
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createOrganization)(orgName));
    let pathToOrg = pth.with(orgName);
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_key)(orgName, null, "from quickcreate", "14days"));
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createServiceGroup)(pathToOrg, "services"));
    let pathToGroup = pathToOrg.with("services");
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createService)(pathToGroup, "services", "Merrymake"));
    let pathToService = pathToGroup.with("Merrymake");
    return service_template(pathToService, "basic");
}
function sim() {
    (0, utils_1.addToExecuteQueue)(() => new simulator_1.Run(3000).execute());
    return (0, utils_1.finish)();
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let struct = (0, utils_2.fetchOrgRaw)();
            if (struct.org !== null) {
                let orgName = struct.org.name;
                // If in org
                let options = [];
                let selectedGroup = null;
                if (struct.serviceGroup !== null) {
                    selectedGroup = {
                        name: struct.serviceGroup,
                        path: new utils_2.Path(struct.pathToRoot).withoutLastUp(),
                    };
                }
                else {
                    let serviceGroups = (0, utils_1.directoryNames)(new utils_2.Path(), ["event-catalogue"]);
                    if (serviceGroups.length === 1) {
                        selectedGroup = {
                            name: serviceGroups[0].name,
                            path: new utils_2.Path(serviceGroups[0].name),
                        };
                    }
                }
                options.push({
                    long: "sim",
                    short: "s",
                    text: "run a local simulation of the system",
                    action: () => sim(),
                });
                options.push({
                    long: "queue",
                    short: "q",
                    text: "display the message queues or events",
                    action: () => queue(orgName),
                });
                if (fs_1.default.existsSync("mist.json") || fs_1.default.existsSync("merrymake.json")) {
                    // Inside a service
                    options.push({
                        long: "deploy",
                        short: "d",
                        text: "deploy service to the cloud",
                        action: () => deploy(),
                    });
                    options.push({
                        long: "redeploy",
                        short: "r",
                        text: "redeploy service to the cloud",
                        action: () => redeploy(),
                    });
                    options.push({
                        long: "build",
                        short: "b",
                        text: "build service locally",
                        action: () => build(),
                    });
                }
                else {
                    // Not inside a service
                    options.push({
                        long: "fetch",
                        short: "f",
                        text: "fetch updates to service groups and services",
                        action: () => fetch(),
                    });
                    if (selectedGroup !== null) {
                        // Inside a service group or has one service
                        let selectedGroup_hack = selectedGroup;
                        options.push({
                            long: "repo",
                            short: "r",
                            text: "create a new repo",
                            action: () => service(selectedGroup_hack.path, orgName, selectedGroup_hack.name),
                        });
                    }
                }
                if (selectedGroup !== null) {
                    // Inside a service group or service
                    let selectedGroup_hack = selectedGroup;
                    options.push({
                        long: "envvar",
                        short: "e",
                        text: "add or edit envvar for service group",
                        action: () => envvar(orgName, selectedGroup_hack.name),
                    });
                }
                if (struct.serviceGroup === null) {
                    // In top level of organization
                    options.push({
                        long: "group",
                        short: "g",
                        text: "create a new service group",
                        action: () => group(new utils_2.Path(), orgName),
                    });
                }
                options.push({
                    long: "cron",
                    short: "c",
                    text: "add or edit cron jobs for the organization",
                    action: () => cron(orgName),
                });
                options.push({
                    long: "key",
                    short: "k",
                    text: "add or edit api-keys for the organization",
                    action: () => keys(orgName),
                });
                return yield (0, prompt_1.choice)(options).then((x) => x);
            }
            else {
                let cache = (0, utils_1.getCache)();
                let options = [];
                options.push({
                    long: "register",
                    short: "r",
                    text: "register new device or user",
                    action: () => register(),
                    weight: !cache.registered ? 10 : 1,
                });
                options.push({
                    long: "quickstart",
                    text: "automatically register, and setup a standard demo organization",
                    action: () => quickstart(),
                    weight: !cache.registered ? 15 : 2,
                });
                options.push({
                    long: "org",
                    short: "o",
                    text: "create a new organization",
                    action: () => org(),
                    weight: 5,
                });
                options.push({
                    long: "clone",
                    short: "c",
                    text: "clone an existing organization",
                    action: () => checkout(),
                    weight: cache.hasOrgs ? 10 : 3,
                });
                options.sort((a, b) => b.weight - a.weight);
                return yield (0, prompt_1.choice)(options).then((x) => x);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.start = start;
