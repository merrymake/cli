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
exports.envvar = void 0;
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const config_1 = require("../config");
const path_1 = __importDefault(require("path"));
const secret_lib_1 = require("@merrymake/secret-lib");
const prompt_1 = require("../prompt");
function do_envvar(pathToOrganization, organizationId, serviceGroupId, key, value, access, encrypted) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let val;
            if (encrypted === true) {
                let repoBase = `${config_1.GIT_HOST}/o${organizationId.toString()}/g${serviceGroupId.toString()}/.key`;
                yield (0, utils_1.execPromise)(`git clone -q "${repoBase}"`, pathToOrganization.with(".merrymake").toString());
                let key = fs_1.default.readFileSync(pathToOrganization
                    .with(".merrymake")
                    .with(".key")
                    .with("merrymake.key")
                    .toString());
                val = new secret_lib_1.MerrymakeCrypto()
                    .encrypt(Buffer.from(value), key)
                    .toString("base64");
            }
            else {
                val = value;
            }
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`envvar-set`, key, ...access, `--serviceGroupId`, serviceGroupId.toString(), `--value`, val, ...(encrypted ? ["--encrypted"] : [])));
            if (encrypted === true) {
                fs_1.default.rmSync(path_1.default.join(pathToOrganization.with(".merrymake").with(".key").toString()), {
                    force: true,
                    recursive: true,
                });
            }
        }
        catch (e) {
            throw e;
        }
    });
}
function envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, access, secret) {
    (0, utils_1.addToExecuteQueue)(() => do_envvar(pathToOrganization, organizationId, serviceGroupId, key, value, access, secret));
    return (0, utils_1.finish)();
}
function envvar_key_visible_value(pathToOrganization, organizationId, serviceGroupId, key, value, secret) {
    return (0, prompt_1.choice)("Where would you like the variable to be visible?", [
        {
            long: "both",
            short: "b",
            text: "accessible in both prod and smoke test",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inProduction", "--inInitRun"], secret),
        },
        {
            long: "prod",
            short: "p",
            text: "accessible in prod",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inProduction"], secret),
        },
        {
            long: "init",
            short: "i",
            text: "accessible in the init run",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inInitRun"], secret),
        },
    ]);
}
function envvar_key_visible(pathToOrganization, organizationId, serviceGroupId, key, secret) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let value = yield (0, prompt_1.shortText)("Value", "The value...", "", secret === true ? prompt_1.Visibility.Secret : prompt_1.Visibility.Public).then();
            if (value !== "")
                return envvar_key_visible_value(pathToOrganization, organizationId, serviceGroupId, key, value, secret);
            else
                return envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inProduction", "--inInitRun"], false);
        }
        catch (e) {
            throw e;
        }
    });
}
function envvar_key(pathToOrganization, organizationId, serviceGroupId, key) {
    return (0, prompt_1.choice)("What is the visibility of the variable?", [
        {
            long: "secret",
            short: "s",
            text: "the value is secret",
            action: () => envvar_key_visible(pathToOrganization, organizationId, serviceGroupId, key, true),
        },
        {
            long: "public",
            short: "p",
            text: "the value is public",
            action: () => envvar_key_visible(pathToOrganization, organizationId, serviceGroupId, key, false),
        },
        {
            long: "delete",
            short: "d",
            text: "delete the environment variable",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, "", ["--inProduction", "--inInitRun"], false),
        },
    ]);
}
function envvar_new(pathToOrganization, organizationId, serviceGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let key = yield (0, prompt_1.shortText)("Key", "Key for the key-value pair", "key").then();
            return envvar_key(pathToOrganization, organizationId, serviceGroupId, key);
        }
        catch (e) {
            throw e;
        }
    });
}
function envvar(pathToOrganization, organizationId, serviceGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`envvar-list`, serviceGroupId.toString());
            let orgs = JSON.parse(resp);
            let options = orgs.map((x) => ({
                long: x.k,
                text: `[${x.i ? "I" : " "}${x.p ? "P" : " "}] ${x.k}: ${x.v}`,
                action: () => envvar_key(pathToOrganization, organizationId, serviceGroupId, x.k),
            }));
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new environment variable`,
                action: () => envvar_new(pathToOrganization, organizationId, serviceGroupId),
            });
            return yield (0, prompt_1.choice)("Which environment variable do you want to edit?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.envvar = envvar;
