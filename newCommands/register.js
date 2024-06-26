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
exports.register = exports.do_register = exports.addKnownHost = exports.generateNewKey = exports.useExistingKey = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("../utils");
const config_1 = require("../config");
const prompt_1 = require("../prompt");
const wait_1 = require("./wait");
const org_1 = require("./org");
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
                if (line.includes("User ") && !line.includes(`User ${config_1.SSH_USER}`)) {
                    lines[i] =
                        line.substring(0, line.indexOf("User ")) + `User ${config_1.SSH_USER}`;
                    changed = true;
                }
                else if (line.includes("IdentityFile ") &&
                    !line.includes(`IdentityFile ~/.ssh/${path}`)) {
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
        (0, prompt_1.output)(`Saving preference...\n`);
        fs_1.default.writeFileSync(`${os_1.default.homedir()}/.ssh/config`, lines.join("\n"));
    }
}
function useExistingKey(path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            saveSSHConfig(path);
            (0, prompt_1.output)(`Reading ${path}.pub...\n`);
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
            (0, prompt_1.output)(`Generating new ssh key...\n`);
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
function addKnownHost() {
    let isKnownHost = false;
    if (fs_1.default.existsSync(`${os_1.default.homedir()}/.ssh/known_hosts`)) {
        let lines = ("" + fs_1.default.readFileSync(`${os_1.default.homedir()}/.ssh/known_hosts`)).split("\n");
        isKnownHost = lines.some((x) => x.includes(`${config_1.API_URL} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO`));
    }
    if (!isKnownHost) {
        (0, prompt_1.output)("Adding fingerprint...\n");
        if (!fs_1.default.existsSync(os_1.default.homedir() + "/.ssh"))
            fs_1.default.mkdirSync(os_1.default.homedir() + "/.ssh");
        fs_1.default.appendFileSync(`${os_1.default.homedir()}/.ssh/known_hosts`, `\n${config_1.API_URL} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO\n`);
    }
}
exports.addKnownHost = addKnownHost;
function do_register(keyAction, email) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let { key, keyFile } = yield keyAction();
            (0, prompt_1.output)("Registering...\n");
            addKnownHost();
            if (email === "") {
                (0, utils_1.addExitMessage)(`Notice: Anonymous accounts are automatically deleted permanently after ~2 weeks, without warning. To add an email and avoid automatic deletion, run the command:
  ${prompt_1.YELLOW}${process.env["COMMAND"]} register ${keyFile}${prompt_1.NORMAL_COLOR}`);
            }
            let result = yield (0, utils_1.urlReq)(`${config_1.HTTP_HOST}/admin/user`, "POST", JSON.stringify({
                email,
                key,
            }));
            if (result.code !== 200)
                throw result.body;
            const needsVerify = result.body === "true";
            return needsVerify
                ? (0, wait_1.wait)("Click the button in the email before continuing", org_1.orgAction)
                : (0, org_1.orgAction)();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_register = do_register;
function register_key(keyAction) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let email = yield (0, prompt_1.shortText)("Email", "By attaching an email you'll be notified in case of changes for your organizations.", "").then();
            return do_register(keyAction, email);
        }
        catch (e) {
            throw e;
        }
    });
}
function register_manual() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let key = yield (0, prompt_1.shortText)("Public key", "", "ssh-rsa ...").then();
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
            let keyfiles = (0, utils_1.getFiles)(new utils_1.Path(`${os_1.default.homedir()}/.ssh`)).filter((x) => x.endsWith(".pub"));
            let keys = keyfiles.map((x) => {
                let f = x.substring(0, x.length - ".pub".length);
                return {
                    long: f,
                    text: `use key ${f}`,
                    action: () => register_key(() => useExistingKey(f)),
                };
            });
            keys.push({
                long: "add",
                short: "a",
                text: "manually add key",
                action: () => register_manual(),
            });
            let def = keyfiles.indexOf("merrymake.pub");
            if (def < 0) {
                keys.push({
                    long: "new",
                    short: "n",
                    text: "setup new key specifically for Merrymake",
                    action: () => register_key(generateNewKey),
                });
                def = keys.length - 1;
            }
            return yield (0, prompt_1.choice)("Which SSH key would you like to use?", keys, {
                invertedQuiet: { cmd: false, select: true },
                def,
            }).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.register = register;
