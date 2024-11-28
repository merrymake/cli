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
exports.do_event = do_event;
exports.event = event;
const prompt_1 = require("../prompt");
const utils_1 = require("../utils");
const apikey_1 = require("./apikey");
function do_event(apikeyId, events) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const selected = Object.keys(events).filter((x) => events[x]);
            yield (0, utils_1.sshReq)(`events-allow`, apikeyId, `--events`, selected.join(","));
            (0, utils_1.output2)(`Allowed event${selected.length > 1 ? "s" : ""} ${selected.join(", ")} on key ${apikeyId}.`);
        }
        catch (e) {
            throw e;
        }
    });
}
function event_key_events(apikeyId, events) {
    (0, utils_1.addToExecuteQueue)(() => do_event(apikeyId, events));
    return (0, utils_1.finish)();
}
function event_key(apikeyId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`events-list`, apikeyId);
            const parsed = JSON.parse(resp);
            const events = {};
            parsed.forEach((x) => (events[x.event] = x.allowed));
            return yield (0, prompt_1.multiSelect)(events, (s) => event_key_events(apikeyId, s), "No events in event-catalogue. Make sure you have added events to the event-catalogue and deployed it.");
        }
        catch (e) {
            throw e;
        }
    });
}
function event(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`apikey-list`, organizationId.toString());
            const keys = JSON.parse(resp);
            const options = keys.map((x) => {
                const n = x.name || "";
                return {
                    long: x.id,
                    text: x.name === null ? x.id : `${x.name} (${x.id})`,
                    action: () => event_key(x.id),
                };
            });
            options.push({
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => (0, apikey_1.key_create)(organizationId, event_key),
            });
            return yield (0, prompt_1.choice)("Which key to allow events through?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
