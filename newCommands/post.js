"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.do_post = do_post;
exports.do_post_file = do_post_file;
exports.post = post;
const ext2mime_1 = require("@merrymake/ext2mime");
const fs_1 = __importStar(require("fs"));
const config_1 = require("../config");
const prompt_1 = require("../prompt");
const utils_1 = require("../utils");
const apikey_1 = require("./apikey");
function do_post(eventType, key, contentType, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(`Sending POST request to ${config_1.RAPIDS_HOST}/${key}/${eventType}`);
            const resp = yield (0, utils_1.urlReq)(`${config_1.RAPIDS_HOST}/${key}/${eventType}`, "POST", payload, contentType);
            (0, utils_1.output2)(resp.body);
        }
        catch (e) {
            throw e;
        }
    });
}
function do_post_file(eventType, key, filename) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const content = fs_1.default.readFileSync(filename).toString();
            const type = (0, ext2mime_1.optimisticMimeTypeOf)(filename.substring(filename.lastIndexOf(".") + 1));
            if (type === null)
                throw "Could not determine content type";
            (0, utils_1.output2)(`Sending POST request to ${config_1.RAPIDS_HOST}/${key}/${eventType}`);
            const resp = yield (0, utils_1.urlReq)(`${config_1.RAPIDS_HOST}/${key}/${eventType}`, "POST", content, type.toString());
            (0, utils_1.output2)(resp.body);
        }
        catch (e) {
            throw e;
        }
    });
}
function post_event_payload_key(foo) {
    (0, utils_1.addToExecuteQueue)(foo);
    return (0, utils_1.finish)();
}
function post_key(organizationId, foo) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`apikey-list`, organizationId.toString());
            const keys = JSON.parse(resp);
            const options = keys.map((x) => {
                const n = x.name ? ` (${x.name})` : "";
                return {
                    long: x.id,
                    text: `${x.id}${n}`,
                    action: () => post_event_payload_key(() => foo(x.id)),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => (0, apikey_1.key_create)(organizationId, (key) => post_event_payload_key(() => foo(key))),
            });
            return yield (0, prompt_1.choice)("Which key to post through?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function post_event_payload_type(organizationId, eventType, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const payload = yield (0, prompt_1.shortText)("Payload", "The data to be attached to the request", "").then();
            return post_key(organizationId, (key) => do_post(eventType, key, contentType, payload));
        }
        catch (e) {
            throw e;
        }
    });
}
function post_event_payload_file(organizationId, eventType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const files = (0, fs_1.readdirSync)(".", { withFileTypes: true }).flatMap((x) => x.isDirectory() ? [] : [x.name]);
            const options = files.map((x) => {
                return {
                    long: x,
                    text: x,
                    action: () => post_key(organizationId, (key) => do_post_file(eventType, key, x)),
                };
            });
            return yield (0, prompt_1.choice)("Which file would you like to send?", options, {}).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function post_event(organizationId, eventType) {
    return (0, prompt_1.choice)("What type of payload should the event use?", [
        {
            long: "empty",
            short: "e",
            text: "empty message, ie. no payload",
            action: () => post_key(organizationId, (key) => do_post(eventType, key, `text/plain`, ``)),
        },
        {
            long: "file",
            short: "f",
            text: "attach file content payload",
            action: () => post_event_payload_file(organizationId, eventType),
        },
        {
            long: "text",
            short: "t",
            text: "attach plain text payload",
            action: () => post_event_payload_type(organizationId, eventType, `text/plain`),
        },
        {
            long: "json",
            short: "j",
            text: "attach json payload",
            action: () => post_event_payload_type(organizationId, eventType, `application/json`),
        },
    ]);
}
function post(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const eventType = yield (0, prompt_1.shortText)("Event type", "The type of event to post", "hello").then();
            return post_event(organizationId, eventType);
        }
        catch (e) {
            throw e;
        }
    });
}
