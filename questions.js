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
const words_1 = require("./words");
const process_1 = require("process");
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
function help() {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_help)());
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
function join_org(name) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_join)(name));
    return (0, utils_1.finish)();
}
function roles_user_attach_role(org, user, role) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_attach_role)(org, user, role));
    return (0, utils_1.finish)();
}
function roles_auto_domain_role(org, domain, role) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_auto_approve)(org, domain, role));
    return (0, utils_1.finish)();
}
function roles_auto_remove(org, domain) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_remove_auto_approve)(org, domain));
    return (0, utils_1.finish)();
}
function spending(org) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_spending)(org));
    return (0, utils_1.finish)();
}
function delete_service_name(org, group, service) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_delete_service)(org, group, service));
    return (0, utils_1.finish)();
}
function delete_group_name(org, group) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_delete_group)(org, group));
    return (0, utils_1.finish)();
}
function delete_org_name(org) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_delete_org)(org));
    return (0, utils_1.finish)();
}
function service_template(pathToService, template) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let langs = yield Promise.all(templates_1.templates[template].languages.map((x, i) => (() => __awaiter(this, void 0, void 0, function* () {
                return (Object.assign(Object.assign({}, templates_1.languages[x]), { weight: yield (0, utils_1.execPromise)(detect_project_type_1.VERSION_CMD[templates_1.languages[x].projectType])
                        .then((r) => {
                        return templates_1.templates[template].languages.length + 1 - i;
                    })
                        .catch((e) => {
                        return -i;
                    }) }));
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
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_duplicate)(pathToService, org, group, service));
    if (deploy)
        (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_deploy)(pathToService));
    return (0, utils_1.finish)();
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
            let name = yield (0, prompt_1.shortText)("Repository name", "This is where the code lives.", "service-1").then((x) => x);
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
            let name = yield (0, prompt_1.shortText)("Service group name", "Used to share envvars.", "service-group-1").then((x) => x);
            (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createServiceGroup)(path, name));
            return service(path.with(name), org, name);
        }
        catch (e) {
            throw e;
        }
    });
}
const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
function generateString(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
function org() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let orgName = generateOrgName();
            let name = yield (0, prompt_1.shortText)("Organization name", "Used when collaborating with others.", orgName).then((x) => x);
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
function register_manual() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let key = yield (0, prompt_1.shortText)("Public key", "", "ssh-rsa ...").then((x) => x);
            return register_key(() => Promise.resolve({
                key,
                keyFile: `add "${key}"`,
            }));
        }
        catch (e) {
            throw e;
        }
    });
}
function register() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let keyfiles = (0, utils_1.getFiles)(new utils_2.Path(`${os_1.default.homedir()}/.ssh`), "").filter((x) => x.endsWith(".pub"));
            let keys = keyfiles.map((x) => {
                let f = x.substring(0, x.length - ".pub".length);
                return {
                    long: f,
                    text: `Use key ${f}`,
                    action: () => register_key(() => (0, executors_1.useExistingKey)(f)),
                };
            });
            keys.push({
                long: "add",
                short: "a",
                text: "Manually add key",
                action: () => register_manual(),
            });
            if (!keyfiles.includes("merrymake")) {
                keys.push({
                    long: "new",
                    short: "n",
                    text: "Setup new key specifically for Merrymake",
                    action: () => register_key(executors_1.generateNewKey),
                });
            }
            return yield (0, prompt_1.choice)(keys, {
                invertedQuiet: { cmd: false, select: true },
                def: keys.length - 1,
            }).then((x) => x);
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
            if ((0, args_1.getArgs)().length > 0 && (0, args_1.getArgs)()[0] !== "_") {
                let org = (0, args_1.getArgs)().splice(0, 1)[0];
                return yield checkout_org(org);
            }
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
    (0, executors_1.printTableHeader)("      ", {
        River: 12,
        Event: 12,
        Status: 7,
        "Queue time": 23,
    });
    return (0, prompt_1.choice)(cache_queue
        .filter((x) => x.id === id)
        .map((x) => ({
        long: x.r,
        text: `${(0, executors_1.alignRight)(x.r, 12)} │ ${(0, executors_1.alignLeft)(x.e, 12)} │ ${(0, executors_1.alignLeft)(x.s, 7)} │ ${new Date(x.q).toLocaleString()}`,
        action: () => queue_event(org, x.id, x.r),
    })), { invertedQuiet: { cmd: true, select: true } }).then((x) => x);
}
function queue_time_value(org, time) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_queue_time)(org, time));
    return (0, utils_1.finish)();
}
function queue_time(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let d = new Date(yield (0, prompt_1.shortText)("Time", "Displays events _around_ specified time.", "1995-12-17T03:24:00")).getTime();
            while (isNaN(d)) {
                (0, utils_1.output2)("Invalid date, please try again.");
                d = new Date(yield (0, prompt_1.shortText)("Time", "Displays events _around_ specified time.", "1995-12-17T03:24:00")).getTime();
            }
            return queue_time_value(org, d);
        }
        catch (e) {
            throw e;
        }
    });
}
const QUEUE_COUNT = 15;
function queue(org, offset) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let options;
            if (["time", "next"].includes((0, args_1.getArgs)()[0])) {
                options = [];
            }
            else {
                let resp = yield (0, utils_1.sshReq)(`queue`, `--org`, org, "--count", "" + QUEUE_COUNT, "--offset", "" + offset);
                cache_queue = JSON.parse(resp);
                (0, executors_1.printTableHeader)("      ", {
                    Id: 6,
                    River: 12,
                    Event: 12,
                    Status: 7,
                    "Queue time": 20,
                });
                options = cache_queue.map((x) => ({
                    long: x.id,
                    text: `${x.id} │ ${(0, executors_1.alignRight)(x.r, 12)} │ ${(0, executors_1.alignLeft)(x.e, 12)} │ ${(0, executors_1.alignLeft)(x.s, 7)} │ ${new Date(x.q).toLocaleString()}`,
                    action: () => {
                        if ((0, args_1.getArgs)().length === 0)
                            (0, args_1.initializeArgs)([x.r]);
                        return queue_id(org, x.id);
                    },
                }));
            }
            options.push({
                long: `next`,
                short: `n`,
                text: `next page`,
                action: () => queue(org, offset + QUEUE_COUNT),
            });
            options.push({
                long: `time`,
                short: `t`,
                text: `specify time`,
                action: () => queue_time(org),
            });
            return yield (0, prompt_1.choice)(options, {
                invertedQuiet: { cmd: false, select: false },
            }).then((x) => x);
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
function keys(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-keys`, `--org`, org);
            let keys = JSON.parse(resp);
            let options = keys.map((x) => {
                let d = new Date(x.expiry);
                let ds = d.getTime() < Date.now()
                    ? `${prompt_1.RED}${d.toLocaleString()}${prompt_1.NORMAL_COLOR}`
                    : d.toLocaleString();
                let n = x.name || "";
                return {
                    long: x.key,
                    text: `${x.key} │ ${(0, executors_1.alignLeft)(n, Math.max(process_1.stdout.getWindowSize()[0] -
                        36 -
                        23 -
                        "─┼──┼─".length -
                        "      ".length, 12))} │ ${ds}`,
                    action: () => keys_key(org, x.key, x.name),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => keys_key(org, null, ""),
            });
            if (options.length > 1)
                (0, executors_1.printTableHeader)("      ", {
                    Key: 36,
                    Description: -12,
                    "Expiry time": 23,
                });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function roles_user_attach(org, user) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-roles`, `--org`, org);
            let roles = JSON.parse(resp);
            let options = roles.map((role) => {
                return {
                    long: role,
                    text: `assign ${role}`,
                    action: () => roles_user_attach_role(org, user, role),
                };
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function roles_user(org, user) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let options = [];
            options.push({
                long: `assign`,
                short: `a`,
                text: `assign an additional role to user`,
                action: () => roles_user_attach(org, user),
            });
            options.push({
                long: `remove`,
                short: `r`,
                text: `remove all roles and access`,
                action: () => roles_user_attach_role(org, user, "Pending"),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function roles_auto_new_domain(org, domain) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-roles`, `--org`, org);
            let roles = JSON.parse(resp);
            let options = roles.map((role) => {
                return {
                    long: role,
                    text: `auto assign ${role}`,
                    action: () => roles_auto_domain_role(org, domain, role),
                };
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function roles_auto_new(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let domain = yield (0, prompt_1.shortText)("Domain", "Email domain to auto approve.", `@${org}.com`).then((x) => x);
            return roles_auto_new_domain(org, domain);
        }
        catch (e) {
            throw e;
        }
    });
}
function roles_auto(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-preapproved`, `--org`, org);
            let domains = JSON.parse(resp);
            let doms = {};
            domains.forEach((x) => {
                if (doms[x.domain] === undefined)
                    doms[x.domain] = [];
                doms[x.domain].push(x.role);
            });
            let options = Object.keys(doms).map((domain) => {
                return {
                    long: domain,
                    text: `remove ${domain} (${doms[domain].join(", ")})`,
                    action: () => roles_auto_remove(org, domain),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `setup a new domain rule`,
                action: () => roles_auto_new(org),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function roles(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-users`, `--org`, org);
            let users = JSON.parse(resp);
            let options = Object.keys(users).map((user) => {
                return {
                    long: user,
                    text: `${user}: ${users[user].join(", ")}`,
                    action: () => roles_user(org, user),
                };
            });
            // options.push({
            //   long: `new`,
            //   short: `n`,
            //   text: `create a new role`,
            //   action: () => roles_new(org),
            // });
            options.push({
                long: `auto`,
                short: `a`,
                text: `configure domain auto approval`,
                action: () => roles_auto(org),
            });
            return yield (0, prompt_1.choice)(options).then((x) => x);
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
    if (value === "")
        return envvar_key_value_access_visible(org, group, overwrite, key, value, access, "--public");
    return (0, prompt_1.choice)([
        {
            long: "secret",
            short: "s",
            text: "keep the value secret",
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
            let value = yield (0, prompt_1.shortText)("Value", "The value...", "");
            if (value !== "")
                return envvar_key_value(org, group, overwrite, key, value);
            else
                return envvar_key_value_access_visible(org, group, overwrite, key, value, ["--prod", "--test"], "--public");
        }
        catch (e) {
            throw e;
        }
    });
}
function post_event_key_payload(eventType, key, contentType, payload) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_post)(eventType, key, contentType, payload));
    return (0, utils_1.finish)();
}
function post_event_key_payloadType(eventType, key, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let payload = yield (0, prompt_1.shortText)("Payload", "The data to be attached to the request", "");
            return post_event_key_payload(eventType, key, contentType, payload);
        }
        catch (e) {
            throw e;
        }
    });
}
function post_event_key(eventType, key) {
    return (0, prompt_1.choice)([
        {
            long: "empty",
            short: "e",
            text: "empty message, ie. no payload",
            action: () => post_event_key_payload(eventType, key, `plain/text`, ``),
        },
        {
            long: "text",
            short: "t",
            text: "attach plain text payload",
            action: () => post_event_key_payloadType(eventType, key, `plain/text`),
        },
        {
            long: "json",
            short: "j",
            text: "attach json payload",
            action: () => post_event_key_payloadType(eventType, key, `application/json`),
        },
    ]);
}
function post_event(org, eventType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if ((0, args_1.getArgs)().length > 0 && (0, args_1.getArgs)()[0] !== "_") {
                let key = (0, args_1.getArgs)().splice(0, 1)[0];
                return yield post_event_key(eventType, key);
            }
            let resp = yield (0, utils_1.sshReq)(`list-keys`, `--org`, org, `--active`);
            let keys = JSON.parse(resp);
            let options = keys.map((x) => {
                let n = x.name ? ` (${x.name})` : "";
                return {
                    long: x.key,
                    text: `${x.key}${n}`,
                    action: () => post_event_key(eventType, x.key),
                };
            });
            return yield (0, prompt_1.choice)(options, {
                errorMessage: `Organization has no active API keys. You can create one with '${prompt_1.YELLOW}${process.env["COMMAND"]} key${prompt_1.NORMAL_COLOR}'`,
            }).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function post(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let eventType = yield (0, prompt_1.shortText)("Event type", "The type of event to post", "hello");
            return post_event(org, eventType);
        }
        catch (e) {
            throw e;
        }
    });
}
function event_key_events(key, events) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_event)(key, events));
    return (0, utils_1.finish)();
}
function event_key(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-events`, `--key`, key);
            let events = JSON.parse(resp);
            return yield (0, prompt_1.multiSelect)(events, (s) => event_key_events(key, s), "No events in event-catalogue. Make sure you have added events to the event-catalogue and deployed it.");
        }
        catch (e) {
            throw e;
        }
    });
}
function event(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-keys`, `--org`, org, `--active`);
            let keys = JSON.parse(resp);
            let options = keys.map((x) => {
                let n = x.name || "";
                return {
                    long: x.key,
                    text: `${x.key} │ ${(0, executors_1.alignLeft)(n, process_1.stdout.getWindowSize()[0] - 36 - 9)}`,
                    action: () => event_key(x.key),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => keys_key(org, null, ""),
            });
            if (options.length > 1)
                (0, executors_1.printTableHeader)("      ", { Key: 36, Name: -12 });
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
                text: `[${x.test ? "T" : " "}${x.prod ? "P" : " "}] ${x.key}: ${x.val ? x.val : "***"}`,
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
function delete_service(org, group) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-services`, `--org`, org, `--team`, group);
            let orgs = JSON.parse(resp);
            return yield (0, prompt_1.choice)(orgs.map((x) => ({
                long: x,
                text: `delete ${x}`,
                action: () => delete_service_name(org, group, x),
            })), { disableAutoPick: true }).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function delete_group(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-teams`, `--org`, org);
            let orgs = JSON.parse(resp);
            return yield (0, prompt_1.choice)(orgs.map((x) => ({
                long: x,
                text: `delete ${x}`,
                action: () => delete_group_name(org, x),
            })), { disableAutoPick: true }).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function delete_org() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-organizations`);
            let orgs = JSON.parse(resp);
            return yield (0, prompt_1.choice)(orgs.map((x) => ({
                long: x,
                text: `delete ${x}`,
                action: () => delete_org_name(x),
            })), { disableAutoPick: true }).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function join() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let name = yield (0, prompt_1.shortText)("Organization to join", "Name of the organization you wish to request access to.", null).then((x) => x);
            return join_org(name);
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
            let expression = yield (0, prompt_1.shortText)("Cron expression", "Eg. every 5 minutes is '*/5 * * * *'", "");
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
                text: `${(0, executors_1.alignRight)(x.name, 30)} │ ${(0, executors_1.alignLeft)(x.event, 18)} │ ${x.expression}`,
                action: () => cron_name(org, x.name, x.event, x.expression),
            }));
            options.push({
                long: `new`,
                short: `n`,
                text: `setup a new cron job`,
                action: () => cron_new(org),
            });
            if (options.length > 1)
                (0, executors_1.printTableHeader)("      ", { Name: 30, Event: 18, Expression: 20 });
            return yield (0, prompt_1.choice)(options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function generateOrgName() {
    if (process.env["MERRYMAKE_NAME_LENGTH"] !== undefined &&
        !Number.isNaN(+process.env["MERRYMAKE_NAME_LENGTH"])) {
        const base = `org-${new Date().toLocaleDateString().replace(/\//g, "-")}-`;
        return (base + generateString(+process.env["MERRYMAKE_NAME_LENGTH"] - base.length));
    }
    else
        return (words_1.ADJECTIVE[~~(words_1.ADJECTIVE.length * Math.random())] +
            "-" +
            words_1.NOUN[~~(words_1.NOUN.length * Math.random())] +
            "-" +
            words_1.NOUN[~~(words_1.NOUN.length * Math.random())]);
}
function quickstart() {
    let cache = (0, utils_1.getCache)();
    if (!cache.registered)
        (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_register)(executors_1.generateNewKey, ""));
    let orgName = generateOrgName();
    let pth = new utils_2.Path();
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createOrganization)(orgName));
    let pathToOrg = pth.with(orgName);
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_key)(orgName, null, "from quickcreate", "14days"));
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createServiceGroup)(pathToOrg, "service-group-1"));
    let pathToGroup = pathToOrg.with("service-group-1");
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.createService)(pathToGroup, "service-group-1", "service-1"));
    let pathToService = pathToGroup.with("service-1");
    return service_template(pathToService, "basic");
}
function sim() {
    (0, utils_1.addToExecuteQueue)(() => new simulator_1.Run(3000).execute());
    return (0, utils_1.finish)();
}
const SPECIAL_FOLDERS = ["event-catalogue", "public"];
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let rawStruct = (0, utils_2.fetchOrgRaw)();
            if (rawStruct.org !== null) {
                let orgName = rawStruct.org.name;
                // If in org
                let options = [];
                let selectedGroup = null;
                let struct = {
                    org: rawStruct.org,
                    serviceGroup: rawStruct.serviceGroup !== null &&
                        !SPECIAL_FOLDERS.includes(rawStruct.serviceGroup)
                        ? rawStruct.serviceGroup
                        : null,
                    inEventCatalogue: rawStruct.serviceGroup === "event-catalogue",
                    inPublic: rawStruct.serviceGroup === "public",
                    pathToRoot: rawStruct.pathToRoot,
                };
                if (struct.serviceGroup !== null) {
                    selectedGroup = {
                        name: struct.serviceGroup,
                        path: new utils_2.Path(struct.pathToRoot).withoutLastUp(),
                    };
                }
                else {
                    let serviceGroups = (0, utils_1.directoryNames)(new utils_2.Path(), [
                        "event-catalogue",
                        "public",
                    ]);
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
                    action: () => queue(orgName, 0),
                });
                if (fs_1.default.existsSync("mist.json") ||
                    fs_1.default.existsSync("merrymake.json") ||
                    struct.inEventCatalogue ||
                    struct.inPublic) {
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
                            text: "create a repo",
                            action: () => service(selectedGroup_hack.path, orgName, selectedGroup_hack.name),
                        });
                    }
                    if (struct.serviceGroup !== null) {
                        let group = struct.serviceGroup;
                        options.push({
                            long: "delete",
                            short: "d",
                            text: "delete a repo",
                            action: () => delete_service(orgName, group),
                        });
                    }
                }
                if (fs_1.default.existsSync("mist.json") || fs_1.default.existsSync("merrymake.json")) {
                    options.push({
                        long: "build",
                        short: "b",
                        text: "build service locally",
                        action: () => build(),
                    });
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
                        text: "create a service group",
                        action: () => group(new utils_2.Path(), orgName),
                    });
                    options.push({
                        long: "delete",
                        short: "d",
                        text: "delete a service group",
                        action: () => delete_group(orgName),
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
                options.push({
                    long: "post",
                    short: "p",
                    text: "post message to Rapids using an api-key",
                    action: () => post(orgName),
                });
                options.push({
                    long: "event",
                    short: "v",
                    text: "allow or disallow events through api-keys for the organization",
                    action: () => event(orgName),
                });
                options.push({
                    long: "role",
                    short: "o",
                    text: "add or assign roles to users in the organization",
                    action: () => roles(orgName),
                });
                options.push({
                    long: "stats",
                    text: "view usage breakdown for the last two months",
                    action: () => spending(orgName),
                });
                options.push({
                    long: "register",
                    short: "r",
                    text: "register an additional sshkey or email to account",
                    action: () => register(),
                });
                options.push({
                    long: "help",
                    text: "help diagnose potential issues",
                    action: () => help(),
                });
                return yield (0, prompt_1.choice)(options).then((x) => x);
            }
            else {
                let cache = (0, utils_1.getCache)();
                let options = [];
                options.push({
                    long: "register",
                    short: "r",
                    text: "register new device or email",
                    action: () => register(),
                    weight: !cache.registered ? 10 : 1,
                });
                options.push({
                    long: "quickstart",
                    text: "quickstart with auto registration and a standard demo organization",
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
                options.push({
                    long: "delete",
                    short: "d",
                    text: "delete an organization",
                    action: () => delete_org(),
                    weight: cache.hasOrgs ? 10 : 3,
                });
                options.push({
                    long: "join",
                    short: "j",
                    text: "request to join an existing organization",
                    action: () => join(),
                    weight: 4,
                });
                options.push({
                    long: "help",
                    text: "help diagnose potential issues",
                    action: () => help(),
                    weight: 0,
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
