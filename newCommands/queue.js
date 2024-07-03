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
exports.queue = exports.do_queue_time = void 0;
const args_1 = require("../args");
const executors_1 = require("../executors");
const prompt_1 = require("../prompt");
const utils_1 = require("../utils");
const post_1 = require("../newCommands/post");
function do_queue_time(org, time) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`queue`, `--org`, org, `--time`, "" + time);
            const queue = JSON.parse(resp);
            (0, utils_1.output2)((0, executors_1.printTableHeader)("", {
                Id: 6,
                River: 12,
                Event: 12,
                Status: 7,
                "Queue time": 20,
            }));
            queue.forEach((x) => (0, utils_1.output2)(`${x.id} │ ${(0, executors_1.alignRight)(x.r, 12)} │ ${(0, executors_1.alignLeft)(x.e, 12)} │ ${(0, executors_1.alignLeft)(x.s, 7)} │ ${new Date(x.q).toLocaleString()}`));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_queue_time = do_queue_time;
function queue_event(id, river) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = JSON.parse(yield (0, utils_1.sshReq)(`rapids-inspect`, id, `--river`, river));
            const resout = res.output;
            delete res.output;
            console.log(res);
            (0, utils_1.output2)("Output:");
            (0, utils_1.output2)(resout);
            return (0, utils_1.finish)();
            // return choice(
            //   "Do you want to replay this service invocation?",
            //   [
            //     {
            //       long: "replay",
            //       text: "replay service invocation",
            //       action: () => queue_event_replay(org, id, river),
            //     },
            //   ],
            //   { disableAutoPick: true }
            // );
        }
        catch (e) {
            throw e;
        }
    });
}
let cache_queue;
function queue_id(id) {
    const tableHeader = (0, executors_1.printTableHeader)("      ", {
        River: 12,
        Event: 12,
        Status: 7,
        "Queue time": 23,
    });
    return (0, prompt_1.choice)("Which event would you like to inspect?\n" + tableHeader, cache_queue
        .filter((x) => x.id === id)
        .map((x) => ({
        long: x.r,
        text: `${(0, executors_1.alignRight)(x.r, 12)} │ ${(0, executors_1.alignLeft)(x.e, 12)} │ ${(0, executors_1.alignLeft)(x.s, 7)} │ ${new Date(x.q).toLocaleString()}`,
        action: () => queue_event(x.id, x.r),
    })), { invertedQuiet: { cmd: true, select: true } }).then();
}
function queue_time_value(org, time) {
    (0, utils_1.addToExecuteQueue)(() => do_queue_time(org, time));
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
function queue(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const options = [];
            const resp = yield (0, utils_1.sshReq)(`rapids-view`, organizationId.toString());
            cache_queue = JSON.parse(resp);
            const tableHeader = "\n" +
                (0, executors_1.printTableHeader)("      ", {
                    Id: 21,
                    "River/Event": 19,
                    Stat: 4,
                    "Queue time": 20,
                });
            options.push(...cache_queue.map((x) => ({
                long: x.id,
                text: `${x.id} │ ${(0, executors_1.alignLeft)(x.r + "/" + x.e, 19)} │ ${(0, executors_1.alignLeft)(x.s.substring(0, 4), 4)} │ ${new Date(x.q).toLocaleString()}`,
                action: () => {
                    if ((0, args_1.getArgs)().length === 0)
                        (0, args_1.initializeArgs)([x.r]);
                    return queue_id(x.id);
                },
            })));
            options.push({
                long: "post",
                short: "p",
                text: "post message to rapids using an api-key",
                action: () => (0, post_1.post)(organizationId),
            });
            return yield (0, prompt_1.choice)("Which event would you like to inspect?" + tableHeader, options, {
                invertedQuiet: { cmd: false, select: false },
            }).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.queue = queue;
