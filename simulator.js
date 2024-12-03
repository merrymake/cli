import { detectProjectType, RUN_COMMAND, } from "@merrymake/detect-project-type";
import { spawn } from "child_process";
import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs";
import http from "http";
import { NORMAL_COLOR, YELLOW } from "./prompt.js";
import { directoryNames, fetchOrg, outputGit, Path } from "./utils.js";
const MILLISECONDS = 1;
const SECONDS = 1000 * MILLISECONDS;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DEFAULT_TIMEOUT = 5 * MINUTES;
export class Run {
    port;
    hooks;
    pathToRoot;
    constructor(port) {
        this.port = port;
        const { pathToRoot } = fetchOrg();
        this.pathToRoot = pathToRoot;
    }
    execute() {
        return new Promise((resolve) => {
            const app = express();
            const server = http.createServer(app);
            const withSession = cookieParser();
            app.use((req, res, next) => {
                if (req.is("multipart/form-data") ||
                    req.is("application/x-www-form-urlencoded")) {
                    express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
                }
                else {
                    express.raw({ type: "*/*", limit: "10mb" })(req, res, next);
                }
            });
            app.post("/trace/:sessionId/:traceId/:event", async (req, res) => {
                try {
                    const traceId = req.params.traceId;
                    const sessionId = req.params.sessionId;
                    const event = req.params.event;
                    const payload = req.body;
                    this.runService(this.pathToRoot, this.port, event, payload, traceId, sessionId, this.hooks, req.headers["content-type"]);
                    res.send("Done");
                }
                catch (e) {
                    if (e.data !== undefined)
                        console.log("" + e.data);
                    else
                        throw e;
                }
            });
            app.get("/rapids/:event", withSession, async (req, res) => {
                try {
                    const payload = Buffer.from(JSON.stringify(req.query));
                    await this.processEvent(req, res, payload);
                }
                catch (e) {
                    if (e.data !== undefined)
                        reply(res, e, undefined);
                    else
                        throw e;
                }
            });
            app.all("/rapids/:event", withSession, async (req, res) => {
                try {
                    const payload = !Buffer.isBuffer(req.body)
                        ? typeof req.body === "object"
                            ? Buffer.from(JSON.stringify(req.body))
                            : Buffer.from(req.body)
                        : req.body;
                    await this.processEvent(req, res, payload);
                }
                catch (e) {
                    if (e.data !== undefined)
                        reply(res, e, undefined);
                    else
                        throw e;
                }
            });
            app.get("/rapids", (req, res) => {
                res.send("Ready.");
            });
            server.listen(this.port, () => {
                outputGit("");
                outputGit(`88.     .88                                                88           `);
                outputGit(`888.   .888                                                88           `);
                outputGit(`88Y8. .8P88                                                88           `);
                outputGit(`88 Y8o8P 88  .88.  88.d8 88.d8 Yb     dP 8888bd88b   .88.8 88  .8P .88. `);
                outputGit(`88  Y8P  88 d"  "b 88"   88"    Yb   dP  88 '88 '8b d"  "8 88 .8P d"  "b`);
                outputGit(`88   "   88 888888 88    88      Yb dP   88  88  88 8    8 88d8P  888888`);
                outputGit(`88       88 Y.     88    88       Y8P    88  88  88 Y.  .8 88" 8b Y.    `);
                outputGit(`88       88  "88P  88    88       dP     88  88  88  "88"8 88  "8b "88P `);
                outputGit(`                                 dP                                     `);
                outputGit("");
                outputGit(`Running local Rapids on ${YELLOW}http://localhost:${this.port}/rapids${NORMAL_COLOR}`);
                outputGit(`To exit, press ctrl+c`);
                outputGit("");
            });
        });
    }
    async processEvent(req, res, payload) {
        try {
            let sessionId = req.cookies.sessionId;
            if (!sessionId) {
                sessionId = "s" + Math.random();
                res.cookie("sessionId", sessionId);
            }
            res.set("Access-Control-Allow-Origin", "*");
            const event = req.params.event;
            this.hooks = new PublicHooks(this.pathToRoot);
            const conf = this.hooks.getApiConfig(event);
            const traceId = "t" + Math.random();
            pendingReplies[traceId] = {
                resp: res,
                channels: new Set(),
            };
            if (conf !== undefined && conf.streaming === true) {
                req.on("close", () => {
                    const rep = pendingReplies[traceId];
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
            const teams = directoryNames(new Path(this.pathToRoot), [
                "event-catalogue",
            ]).map((x) => x.name);
            processFolders(this.pathToRoot, this.pathToRoot, null, teams, this.hooks);
            loadLocalEnvvars(this.pathToRoot);
            const response = await this.runWithReply(this.pathToRoot, this.port, res, event, payload, traceId, sessionId, this.hooks, req.headers["content-type"]);
        }
        catch (e) {
            throw e;
        }
    }
    runService(pathToRoot, port, event, payload, traceId, sessionId, hooks, contentType) {
        if (event === "$reply") {
            const rs = pendingReplies[traceId];
            if (rs !== undefined) {
                delete pendingReplies[traceId];
                reply(rs.resp, HTTP.SUCCESS.SINGLE_REPLY(payload), contentType);
            }
        }
        else if (event === "$join") {
            const to = payload.toString();
            const rs = pendingReplies[traceId];
            if (rs !== undefined) {
                if (channels[to] === undefined)
                    channels[to] = new Set();
                channels[to].add(rs.resp);
                rs.channels.add(to);
            }
        }
        else if (event === "$broadcast") {
            const p = JSON.parse(payload.toString());
            const cs = channels[p.to] || [];
            cs.forEach((c) => {
                c.write(`event: ${p.event}\n`);
                p.payload.split("\n").forEach((x) => c.write(`data: ${x}\n`));
                c.write(`\n`);
            });
        }
        const rivers = hooks.riversFor(event)?.hooks;
        if (rivers === undefined)
            return;
        const messageId = "m" + Math.random();
        const envelope = JSON.stringify({
            messageId,
            traceId,
            sessionId,
        });
        Object.keys(rivers).forEach((river) => {
            const services = rivers[river];
            const service = services[~~(Math.random() * services.length)];
            const [cmd, ...rest] = service.cmd.split(" ");
            const args = [...rest, `'${service.action}'`, `'${envelope}'`];
            const options = {
                cwd: service.dir,
                env: {
                    ...process.env,
                    ...(envvars[service.group] || {}),
                    RAPIDS: `http://localhost:${port}/trace/${sessionId}/${traceId}`,
                },
                shell: "sh",
            };
            if (process.env["DEBUG"])
                console.log(cmd, args);
            const ls = spawn(cmd, args, options);
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
            //   const streaming = pendingReplies[traceId].streaming;
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
    async runWithReply(pathToRoot, port, resp, event, payload, traceId, sessionId, hooks, contentType) {
        try {
            const rivers = hooks.riversFor(event);
            if (rivers === undefined)
                return reply(resp, HTTP.CLIENT_ERROR.NO_HOOKS, "text/plain");
            const conf = hooks.getApiConfig(event);
            this.runService(pathToRoot, port, event, payload, traceId, sessionId, hooks, contentType);
            if (conf === undefined || conf.streaming !== true) {
                await sleep(conf?.waitFor || MAX_WAIT);
                const pending = pendingReplies[traceId];
                if (pending !== undefined) {
                    delete pendingReplies[traceId];
                    reply(resp, HTTP.SUCCESS.QUEUE_JOB, "text/plain");
                }
            }
        }
        catch (e) {
            throw e;
        }
    }
}
const MAX_WAIT = 5000;
const Reset = "\x1b[0m";
const FgRed = "\x1b[31m";
let envvars = {};
let pendingReplies = {};
let channels = {};
class PublicHooks {
    publicEvents;
    hooks = {};
    constructor(pathToRoot) {
        this.publicEvents = JSON.parse("" + fs.readFileSync(`${pathToRoot}/event-catalogue/api.json`));
    }
    getApiConfig(event) {
        return this.publicEvents[event];
    }
    register(event, river, hook) {
        const evt = this.hooks[event] ||
            (this.hooks[event] = {
                waitFor: this.publicEvents[event]?.waitFor,
                hooks: {},
            });
        const rvr = evt.hooks[river] || (evt.hooks[river] = []);
        rvr.push(hook);
    }
    riversFor(event) {
        return this.hooks[event];
    }
}
function isDirectory(folder) {
    try {
        return fs.lstatSync(folder).isDirectory();
    }
    catch (e) {
        return false;
    }
}
function processFolder(pathToRoot, group, folder, hooks) {
    if (fs.existsSync(`${folder}/merrymake.json`)) {
        let projectType;
        let cmd;
        const dir = folder.replace(/\/\//g, "/");
        try {
            projectType = detectProjectType(folder);
            cmd = RUN_COMMAND[projectType](folder);
        }
        catch (e) {
            timedOutput(FgRed +
                `${dir.substring(pathToRoot.length)}: Please build or rebuild the service with '${process.env["COMMAND"]} build'` +
                Reset);
            return;
        }
        const config = JSON.parse("" + fs.readFileSync(`${folder}/merrymake.json`));
        Object.keys(config.hooks).forEach((k) => {
            const [river, event] = k.split("/");
            const hook = config.hooks[k];
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
                dir,
                group,
                cmd,
            });
        });
    }
    else if (isDirectory(folder)) {
        processFolders(pathToRoot, folder, group, fs.readdirSync(folder), hooks);
    }
}
function processFolders(pathToRoot, prefix, group, folders, hooks) {
    folders
        .filter((x) => !x.startsWith("(deleted) "))
        .forEach((folder) => processFolder(pathToRoot, group || folder, prefix + folder + "/", hooks));
}
function loadLocalEnvvars(pathToRoot) {
    fs.readdirSync(pathToRoot)
        .filter((x) => !x.startsWith("(deleted) ") && !x.endsWith(".DS_Store"))
        .forEach((group) => {
        if (fs.existsSync(pathToRoot + "/" + group + "/env.kv")) {
            envvars[group] = {};
            fs.readFileSync(pathToRoot + "/" + group + "/env.kv")
                .toString()
                .split(/\r?\n/)
                .forEach((x) => {
                if (!x.includes("="))
                    return;
                const b = x.split("=");
                envvars[group][b[0]] = b[1];
            });
        }
    });
}
let spacerTimer;
function timedOutput(str) {
    if (spacerTimer !== undefined)
        clearTimeout(spacerTimer);
    outputGit(str);
    spacerTimer = setTimeout(() => outputGit(""), 10000);
}
var HTTP;
(function (HTTP) {
    let SUCCESS;
    (function (SUCCESS) {
        SUCCESS.SINGLE_REPLY = (data) => ({ code: 200, data });
        SUCCESS.QUEUE_JOB = { code: 200, data: Buffer.from("Queued job.") };
    })(SUCCESS = HTTP.SUCCESS || (HTTP.SUCCESS = {}));
    let CLIENT_ERROR;
    (function (CLIENT_ERROR) {
        CLIENT_ERROR.TIMEOUT_JOB = {
            code: 400,
            data: Buffer.from("Job timed out."),
        };
        CLIENT_ERROR.NO_HOOKS = {
            code: 400,
            data: Buffer.from("Event has no hooks."),
        };
        CLIENT_ERROR.TOO_MANY_FILES = (x) => ({
            code: 400,
            data: Buffer.from(`No more than ${x} files allowed.`),
        });
        CLIENT_ERROR.TOO_FEW_FILES = (x) => ({
            code: 400,
            data: Buffer.from(`At least ${x} files required.`),
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
