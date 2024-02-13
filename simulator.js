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
exports.Run = void 0;
const utils_1 = require("./utils");
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const detect_project_type_1 = require("@merrymake/detect-project-type");
const http_1 = __importDefault(require("http"));
const prompt_1 = require("./prompt");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const MILLISECONDS = 1;
const SECONDS = 1000 * MILLISECONDS;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DEFAULT_TIMEOUT = 5 * MINUTES;
class Run {
    constructor(port) {
        this.port = port;
        const { pathToRoot } = (0, utils_1.fetchOrg)();
        this.pathToRoot = pathToRoot;
    }
    execute() {
        return new Promise((resolve) => {
            const app = (0, express_1.default)();
            const server = http_1.default.createServer(app);
            const withSession = (0, cookie_parser_1.default)();
            app.use((req, res, next) => {
                if (req.is("multipart/form-data") ||
                    req.is("application/x-www-form-urlencoded")) {
                    express_1.default.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
                }
                else {
                    express_1.default.raw({ type: "*/*", limit: "10mb" })(req, res, next);
                }
            });
            app.post("/trace/:sessionId/:traceId/:event", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let traceId = req.params.traceId;
                    let sessionId = req.params.sessionId;
                    let event = req.params.event;
                    let payload = req.body;
                    this.runService(this.pathToRoot, this.port, event, payload, traceId, sessionId, this.hooks, req.headers["content-type"]);
                    res.send("Done");
                }
                catch (e) {
                    if (e.data !== undefined)
                        console.log("" + e.data);
                    else
                        throw e;
                }
            }));
            app.get("/rapids/:event", withSession, (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let payload = Buffer.from(JSON.stringify(req.query));
                    yield this.processEvent(req, res, payload);
                }
                catch (e) {
                    if (e.data !== undefined)
                        reply(res, e, undefined);
                    else
                        throw e;
                }
            }));
            app.all("/rapids/:event", withSession, (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let payload = !Buffer.isBuffer(req.body)
                        ? typeof req.body === "object"
                            ? Buffer.from(JSON.stringify(req.body))
                            : Buffer.from(req.body)
                        : req.body;
                    yield this.processEvent(req, res, payload);
                }
                catch (e) {
                    if (e.data !== undefined)
                        reply(res, e, undefined);
                    else
                        throw e;
                }
            }));
            app.get("/rapids", (req, res) => {
                res.send("Running...");
            });
            server.listen(this.port, () => {
                (0, utils_1.output2)("");
                (0, utils_1.output2)(`88.     .88                                                88           `);
                (0, utils_1.output2)(`888.   .888                                                88           `);
                (0, utils_1.output2)(`88Y8. .8P88                                                88           `);
                (0, utils_1.output2)(`88 Y8o8P 88  .88.  88.d8 88.d8 Yb     dP 8888bd88b   .88.8 88  .8P .88. `);
                (0, utils_1.output2)(`88  Y8P  88 d"  "b 88"   88"    Yb   dP  88 '88 '8b d"  "8 88 .8P d"  "b`);
                (0, utils_1.output2)(`88   "   88 888888 88    88      Yb dP   88  88  88 8    8 88d8P  888888`);
                (0, utils_1.output2)(`88       88 Y.     88    88       Y8P    88  88  88 Y.  .8 88" 8b Y.    `);
                (0, utils_1.output2)(`88       88  "88P  88    88       dP     88  88  88  "88"8 88  "8b "88P `);
                (0, utils_1.output2)(`                                 dP                                     `);
                (0, utils_1.output2)("");
                (0, utils_1.output2)(`Running local Rapids on ${prompt_1.YELLOW}http://localhost:${this.port}/rapids${prompt_1.NORMAL_COLOR}`);
                (0, utils_1.output2)(`To exit, press ctrl+c`);
                (0, utils_1.output2)("");
            });
        });
    }
    processEvent(req, res, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let sessionId = req.cookies.sessionId;
                if (!sessionId) {
                    sessionId = "s" + Math.random();
                    res.cookie("sessionId", sessionId);
                }
                res.set("Access-Control-Allow-Origin", "*");
                let event = req.params.event;
                this.hooks = new PublicHooks(this.pathToRoot);
                let conf = this.hooks.getApiConfig(event);
                let traceId = "t" + Math.random();
                pendingReplies[traceId] = {
                    resp: res,
                    channels: new Set(),
                };
                if (conf !== undefined && conf.streaming === true) {
                    req.on("close", () => {
                        let rep = pendingReplies[traceId];
                        rep.channels.forEach((c) => {
                            channels[c].delete(rep.resp);
                            if (channels[c].size === 0) {
                                delete channels[c];
                            }
                        });
                    });
                    res.set("Content-Type", "text/event-stream");
                    res.set("Cache-Control", "no-cache");
                    res.set("Connection", "keep-alive");
                    res.flushHeaders();
                }
                let teams = (0, utils_1.directoryNames)(new utils_1.Path(this.pathToRoot), [
                    "event-catalogue",
                ]).map((x) => x.name);
                processFolders(this.pathToRoot, null, teams, this.hooks);
                loadLocalEnvvars(this.pathToRoot);
                let response = yield this.runWithReply(this.pathToRoot, this.port, res, event, payload, traceId, sessionId, this.hooks, req.headers["content-type"]);
            }
            catch (e) {
                throw e;
            }
        });
    }
    runService(pathToRoot, port, event, payload, traceId, sessionId, hooks, contentType) {
        var _a;
        if (event === "$reply") {
            let rs = pendingReplies[traceId];
            if (rs !== undefined) {
                delete pendingReplies[traceId];
                reply(rs.resp, HTTP.SUCCESS.SINGLE_REPLY(payload), contentType);
            }
        }
        else if (event === "$join") {
            let to = payload.toString();
            let rs = pendingReplies[traceId];
            if (rs !== undefined) {
                if (channels[to] === undefined)
                    channels[to] = new Set();
                channels[to].add(rs.resp);
                rs.channels.add(to);
            }
        }
        else if (event === "$broadcast") {
            let p = JSON.parse(payload.toString());
            let cs = channels[p.to] || [];
            cs.forEach((c) => {
                c.write(`event: ${p.event}\n`);
                p.payload.split("\n").forEach((x) => c.write(`data: ${x}\n`));
                c.write(`\n`);
            });
        }
        let rivers = (_a = hooks.riversFor(event)) === null || _a === void 0 ? void 0 : _a.hooks;
        if (rivers === undefined)
            return;
        let messageId = "m" + Math.random();
        let envelope = JSON.stringify({
            messageId,
            traceId,
            sessionId,
        });
        Object.keys(rivers).forEach((river) => {
            let services = rivers[river];
            let service = services[~~(Math.random() * services.length)];
            let [cmd, ...rest] = service.cmd.split(" ");
            const args = [...rest, `'${service.action}'`, `'${envelope}'`];
            const options = {
                cwd: service.dir,
                env: Object.assign(Object.assign(Object.assign({}, process.env), (envvars[service.group] || {})), { RAPIDS: `http://localhost:${port}/trace/${sessionId}/${traceId}` }),
                shell: "sh",
            };
            if (process.env["DEBUG"])
                console.log(cmd, args);
            let ls = (0, child_process_1.spawn)(cmd, args, options);
            ls.stdin.write(payload);
            ls.stdin.end();
            ls.stdout.on("data", (data) => {
                timedOutput(service.dir.substring(pathToRoot.length) + (": " + data).trimEnd());
            });
            ls.stderr.on("data", (data) => {
                timedOutput(FgRed +
                    service.dir.substring(pathToRoot.length) +
                    (": " + data).trimEnd() +
                    Reset);
            });
            // ls.on("exit", () => {
            //   let streaming = pendingReplies[traceId].streaming;
            //   if (streaming !== undefined) {
            //     streaming.running--;
            //     if (streaming.running === 0) {
            //       pendingReplies[traceId].resp.end();
            //       delete pendingReplies[traceId];
            //     }
            //   }
            // });
        });
    }
    runWithReply(pathToRoot, port, resp, event, payload, traceId, sessionId, hooks, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let rivers = hooks.riversFor(event);
                if (rivers === undefined)
                    return reply(resp, HTTP.CLIENT_ERROR.NO_HOOKS, undefined);
                let conf = hooks.getApiConfig(event);
                this.runService(pathToRoot, port, event, payload, traceId, sessionId, hooks, contentType);
                if (conf === undefined || conf.streaming !== true) {
                    yield sleep((conf === null || conf === void 0 ? void 0 : conf.waitFor) || MAX_WAIT);
                    let pending = pendingReplies[traceId];
                    if (pending !== undefined) {
                        delete pendingReplies[traceId];
                        reply(resp, HTTP.SUCCESS.QUEUE_JOB, undefined);
                    }
                }
            }
            catch (e) {
                throw e;
            }
        });
    }
}
exports.Run = Run;
const MAX_WAIT = 5000;
const Reset = "\x1b[0m";
const FgRed = "\x1b[31m";
let envvars = {};
let pendingReplies = {};
let channels = {};
class PublicHooks {
    constructor(pathToRoot) {
        this.hooks = {};
        this.publicEvents = JSON.parse("" + fs_1.default.readFileSync(`${pathToRoot}/event-catalogue/api.json`));
    }
    getApiConfig(event) {
        return this.publicEvents[event];
    }
    register(event, river, hook) {
        var _a;
        let evt = this.hooks[event] ||
            (this.hooks[event] = {
                waitFor: (_a = this.publicEvents[event]) === null || _a === void 0 ? void 0 : _a.waitFor,
                hooks: {},
            });
        let rvr = evt.hooks[river] || (evt.hooks[river] = []);
        rvr.push(hook);
    }
    riversFor(event) {
        return this.hooks[event];
    }
}
function isDirectory(folder) {
    try {
        return fs_1.default.lstatSync(folder).isDirectory();
    }
    catch (e) {
        return false;
    }
}
function processFolder(group, folder, hooks) {
    if (fs_1.default.existsSync(`${folder}/mist.json`)) {
        let projectType;
        let cmd;
        try {
            projectType = (0, detect_project_type_1.detectProjectType)(folder);
            cmd = detect_project_type_1.RUN_COMMAND[projectType](folder);
        }
        catch (e) {
            console.log(e);
            return;
        }
        let config = JSON.parse("" + fs_1.default.readFileSync(`${folder}/mist.json`));
        Object.keys(config.hooks).forEach((k) => {
            let [river, event] = k.split("/");
            let hook = config.hooks[k];
            let action, timeout_milliseconds;
            if (typeof hook === "object") {
                action = hook.action;
                timeout_milliseconds = hook.timeout || DEFAULT_TIMEOUT;
            }
            else {
                action = hook;
                timeout_milliseconds = DEFAULT_TIMEOUT;
            }
            hooks.register(event, river, {
                action,
                dir: folder.replace(/\/\//g, "/"),
                group,
                cmd,
            });
        });
    }
    else if (fs_1.default.existsSync(`${folder}/merrymake.json`)) {
        let projectType;
        let cmd;
        try {
            projectType = (0, detect_project_type_1.detectProjectType)(folder);
            cmd = detect_project_type_1.RUN_COMMAND[projectType](folder);
        }
        catch (e) {
            console.log(e);
            return;
        }
        let config = JSON.parse("" + fs_1.default.readFileSync(`${folder}/merrymake.json`));
        Object.keys(config.hooks).forEach((k) => {
            let [river, event] = k.split("/");
            let hook = config.hooks[k];
            let action, timeout_milliseconds;
            if (typeof hook === "object") {
                action = hook.action;
                timeout_milliseconds = hook.timeout || DEFAULT_TIMEOUT;
            }
            else {
                action = hook;
                timeout_milliseconds = DEFAULT_TIMEOUT;
            }
            hooks.register(event, river, {
                action,
                dir: folder.replace(/\/\//g, "/"),
                group,
                cmd,
            });
        });
    }
    else if (isDirectory(folder)) {
        processFolders(folder, group, fs_1.default.readdirSync(folder), hooks);
    }
}
function processFolders(prefix, group, folders, hooks) {
    folders
        .filter((x) => !x.startsWith("(deleted) ") && !x.endsWith(".DS_Store"))
        .forEach((folder) => processFolder(group || folder, prefix + folder + "/", hooks));
}
function loadLocalEnvvars(pathToRoot) {
    fs_1.default.readdirSync(pathToRoot)
        .filter((x) => !x.startsWith("(deleted) ") && !x.endsWith(".DS_Store"))
        .forEach((group) => {
        if (fs_1.default.existsSync(pathToRoot + "/" + group + "/env.kv")) {
            envvars[group] = {};
            fs_1.default.readFileSync(pathToRoot + "/" + group + "/env.kv")
                .toString()
                .split(/\r?\n/)
                .forEach((x) => {
                if (!x.includes("="))
                    return;
                let b = x.split("=");
                envvars[group][b[0]] = b[1];
            });
        }
    });
}
let spacerTimer;
function timedOutput(str) {
    if (spacerTimer !== undefined)
        clearTimeout(spacerTimer);
    (0, utils_1.output2)(str);
    spacerTimer = setTimeout(() => (0, utils_1.output2)(""), 10000);
}
var HTTP;
(function (HTTP) {
    let SUCCESS;
    (function (SUCCESS) {
        SUCCESS.SINGLE_REPLY = (data) => ({ code: 200, data });
        SUCCESS.QUEUE_JOB = { code: 200, data: Buffer.from("Queued") };
    })(SUCCESS = HTTP.SUCCESS || (HTTP.SUCCESS = {}));
    let CLIENT_ERROR;
    (function (CLIENT_ERROR) {
        CLIENT_ERROR.TIMEOUT_JOB = {
            code: 400,
            data: Buffer.from("Job timed out"),
        };
        CLIENT_ERROR.NO_HOOKS = {
            code: 400,
            data: Buffer.from("Event has no hooks"),
        };
        CLIENT_ERROR.TOO_MANY_FILES = (x) => ({
            code: 400,
            data: Buffer.from(`No more than ${x} files allowed`),
        });
        CLIENT_ERROR.TOO_FEW_FILES = (x) => ({
            code: 400,
            data: Buffer.from(`At least ${x} files required`),
        });
        CLIENT_ERROR.TOO_LARGE_FILES = (x, s) => ({
            code: 400,
            data: Buffer.from(`Files exceed size limit of ${x}: ${s}`),
        });
        CLIENT_ERROR.ILLEGAL_TYPE = (s) => ({
            code: 400,
            data: Buffer.from(`Illegal mime types: ${s}`),
        });
        CLIENT_ERROR.FILE_NOT_FOUND = (s) => ({
            code: 404,
            data: Buffer.from(`File not found: ${s}`),
        });
    })(CLIENT_ERROR = HTTP.CLIENT_ERROR || (HTTP.CLIENT_ERROR = {}));
})(HTTP || (HTTP = {}));
function sleep(duration) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, duration);
    });
}
function reply(res, response, contentType) {
    if (contentType !== undefined)
        res.contentType(contentType);
    res.status(response.code).send(response.data);
}
