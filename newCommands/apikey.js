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
Object.defineProperty(exports, "__esModule", { value: true });
exports.key = exports.key_create = exports.do_key_modify = exports.do_key_create = void 0;
const process_1 = require("process");
const executors_1 = require("../executors");
const prompt_1 = require("../prompt");
const utils_1 = require("../utils");
function do_key_create(organizationId, description, duration) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cmd = [
                `apikey-create`,
                duration,
                `--organizationId`,
                organizationId.toString(),
            ];
            if (description !== "")
                cmd.push(`--description`, description);
            const reply = yield (0, utils_1.sshReq)(...cmd);
            if (reply.length !== 8)
                throw reply;
            (0, prompt_1.output)(`Created apikey ${description !== "" ? `'${description}'` : ""}: ${prompt_1.YELLOW}${reply}${prompt_1.NORMAL_COLOR}\n`);
            const apikeyId = reply;
            return apikeyId;
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_key_create = do_key_create;
function do_key_modify(apikeyId, description, duration) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cmd = [`apikey-modify`, `--duration`, duration, apikeyId];
            if (description !== "")
                cmd.push(`--description`, description);
            yield (0, utils_1.sshReq)(...cmd);
            (0, utils_1.output2)(`Updated key.`);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_key_modify = do_key_modify;
function key_key_name(description, continuation) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const duration = yield (0, prompt_1.shortText)("Duration", "How long should the key be active? Ex. 1 hour", "14 days");
            return continuation(description, duration);
        }
        catch (e) {
            throw e;
        }
    });
}
function key_key(currentName, continuation) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const description = yield (0, prompt_1.shortText)("Human readable description", "Used to identify this key", currentName);
            return key_key_name(description, continuation);
        }
        catch (e) {
            throw e;
        }
    });
}
function composeAwait(f, g) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const b = yield g;
            return f(b);
        }
        catch (e) {
            throw e;
        }
    });
}
function key_create(organizationId, continuation) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const description = yield (0, prompt_1.shortText)("Human readable description", "Used to identify this key", "");
            return key_key_name(description, (description, duration) => composeAwait(continuation, do_key_create(organizationId, description, duration)));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.key_create = key_create;
function key(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`apikey-list`, organizationId.toString());
            const keys = JSON.parse(resp);
            const options = keys.map((x) => {
                const d = new Date(x.expiresOn);
                const ds = d.getTime() < Date.now()
                    ? `${prompt_1.RED}${d.toLocaleString()}${prompt_1.NORMAL_COLOR}`
                    : d.toLocaleString();
                const n = x.name || "";
                return {
                    long: x.id,
                    text: `${x.id} │ ${(0, executors_1.alignLeft)(n, Math.max(process_1.stdout.getWindowSize()[0] -
                        8 -
                        23 -
                        "─┼──┼─".length -
                        "      ".length, 12))} │ ${ds}`,
                    action: () => key_key(x.name, (description, duration) => composeAwait(utils_1.finish, do_key_modify(x.id, description, duration))),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => key_create(organizationId, utils_1.finish),
            });
            let tableHeader = "";
            if (options.length > 1)
                tableHeader =
                    "\n" +
                        (0, executors_1.printTableHeader)("      ", {
                            Key: 8,
                            Description: -12,
                            "Expiry time": 23,
                        });
            return yield (0, prompt_1.choice)("Which apikey would you like to edit?" + tableHeader, options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.key = key;
