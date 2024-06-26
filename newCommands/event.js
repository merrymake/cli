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
exports.event = exports.do_event = void 0;
const utils_1 = require("../utils");
const prompt_1 = require("../prompt");
const executors_1 = require("../executors");
const process_1 = require("process");
const apikey_1 = require("./apikey");
function do_event(apikeyId, events) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let selected = Object.keys(events).filter((x) => events[x]);
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`events-allow`, apikeyId, `--events`, selected.join(",")));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_event = do_event;
function event_key_events(apikeyId, events) {
    (0, utils_1.addToExecuteQueue)(() => do_event(apikeyId, events));
    return (0, utils_1.finish)();
}
function event_key(apikeyId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`list-events`, apikeyId);
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
            let resp = yield (0, utils_1.sshReq)(`apikey-list`, organizationId.toString());
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
                action: () => (0, apikey_1.key_create)(organizationId, event_key),
            });
            let tableHeader = "";
            if (options.length > 1)
                tableHeader = "\n" + (0, executors_1.printTableHeader)("      ", { Key: 36, Name: -12 });
            return yield (0, prompt_1.choice)("Which key to allow events through?" + tableHeader, options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.event = event;
