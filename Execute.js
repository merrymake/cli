import { detectProjectType, ProjectTypes, } from "@merrymake/detect-project-type";
import { Str } from "@merrymake/utils";
import { spawn, } from "child_process";
import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs";
import net from "net";
import { addToExecuteQueue, finish } from "./exitMessages.js";
import { GRAY, INVISIBLE, NORMAL_COLOR, RED, WHITE, YELLOW } from "./prompt.js";
import { all, generateString } from "./utils.js";
let spacerTimer;
function timedOutput(str, prefix) {
    if (spacerTimer !== undefined)
        clearTimeout(spacerTimer);
    Str.print(str, prefix, INVISIBLE, undefined, true);
    spacerTimer = setTimeout(() => console.log(""), 10000);
}
async function prep(folder, runCommand, env, displayFolder) {
    try {
        const runCmd = await runCommand(folder.toString());
        const [cmd, ...args] = runCmd.split(" ");
        const options = {
            cwd: folder.toString(),
            env,
            shell: "sh",
        };
        const p = spawn(cmd, args, options);
        p.stdout.on("data", (data) => {
            timedOutput(`${data.toString()}`, displayFolder);
        });
        p.stderr.on("data", (data) => {
            timedOutput(`${RED}${data.toString()}${NORMAL_COLOR}`, displayFolder);
        });
        return p;
    }
    catch (e) {
        throw e;
    }
}
function run(p, action, envelope, payload) {
    return new Promise((resolve) => {
        p.stdin.write(pack(Buffer.from(action), Buffer.from(JSON.stringify(envelope)), payload));
        p.stdin.end();
        p.on("close", () => {
            resolve();
        });
    });
}
function numberToBuffer(n) {
    return Buffer.from([n >> 16, n >> 8, n >> 0]);
}
function bufferToNumber(buffers) {
    return (buffers.at(0) << 16) | (buffers.at(1) << 8) | buffers.at(2);
}
function pack(...buffers) {
    const result = [];
    buffers.forEach((x) => result.push(numberToBuffer(x.length), x));
    return Buffer.concat(result);
}
async function execute(handle, pathToRoot, group, repo, action, envelope, payload) {
    try {
        const server = net.createServer((socket) => {
            socket.on("end", () => {
                socket.end();
            });
            socket.on("close", () => {
                server.close();
            });
            let missing = 0;
            const parsed = [];
            let buffer = Buffer.alloc(0);
            socket.on("data", (buf) => {
                buffer = Buffer.concat([buffer, buf]);
                while (true) {
                    if (missing === 0) {
                        if (buffer.length < 3) {
                            return;
                        }
                        missing = bufferToNumber(buffer);
                        buffer = buffer.subarray(3);
                    }
                    if (missing === 0) {
                        parsed.push(Buffer.alloc(0));
                        if (parsed.length === 2) {
                            const [event, payload] = parsed.splice(0, 2);
                            handle(event.toString(), payload);
                        }
                        continue;
                    }
                    if (buffer.length >= missing) {
                        parsed.push(buffer.subarray(0, missing));
                        buffer = buffer.subarray(missing);
                        missing = 0;
                        if (parsed.length === 2) {
                            const [event, payload] = parsed.splice(0, 2);
                            handle(event.toString(), payload);
                        }
                    }
                    else {
                        return;
                    }
                }
            });
        });
        server.listen(() => { });
        const env = process.env || {};
        env.RAPIDS = `localhost:${server.address().port}`;
        if (fs.existsSync(pathToRoot.with(group).with("env.kv").toString())) {
            fs.readFileSync(pathToRoot.with(group).with("env.kv").toString(), "utf-8")
                .split(/\r?\n/)
                .forEach((x) => {
                if (!x.includes("="))
                    return;
                const b = x.split("=");
                env[b[0]] = b[1];
            });
        }
        const folder = pathToRoot.with(group).with(repo);
        const pType = await detectProjectType(folder.toString());
        const p = await prep(folder, (folder) => ProjectTypes[pType].runCommand(folder), env, `${envelope.traceId}:${group}/${repo}`);
        return run(p, action, envelope, payload);
    }
    catch (e) {
        throw e;
    }
}
function parseMerrymakeJson(folder, event) {
    if (!fs.existsSync(folder.with("merrymake.json").toString()))
        throw "Missing merrymake.json";
    const config = JSON.parse(fs.readFileSync(folder.with("merrymake.json").toString(), "utf-8"));
    return Object.keys(config.hooks)
        .filter((x) => x.endsWith(`/${event}`))
        .map((x) => {
        const hook = config.hooks[x];
        const action = typeof hook === "object" ? hook.action : hook;
        return [x.split("/")[0], action];
    });
}
function processFolders(pathToRoot, event) {
    const rivers = {};
    fs.readdirSync(pathToRoot.toString(), { withFileTypes: true })
        .filter((x) => x.isDirectory() &&
        !x.name.startsWith("(deleted) ") &&
        !x.name.endsWith(".DS_Store"))
        .forEach((g) => {
        const group = g.name;
        fs.readdirSync(pathToRoot.with(group).toString())
            .filter((x) => !x.startsWith("(deleted) ") && !x.endsWith(".DS_Store"))
            .forEach((repo) => {
            if (!fs.existsSync(pathToRoot
                .with(group)
                .with(repo)
                .with("merrymake.json")
                .toString()))
                return;
            parseMerrymakeJson(pathToRoot.with(group).with(repo), event).forEach(([river, action]) => {
                if (rivers[river] === undefined)
                    rivers[river] = [];
                rivers[river].push({ group, repo, action });
            });
        });
    });
    return rivers;
}
var Mode;
(function (Mode) {
    Mode[Mode["RECORDING"] = 0] = "RECORDING";
    Mode[Mode["PLAYING"] = 1] = "PLAYING";
    Mode[Mode["NORMAL"] = 2] = "NORMAL";
})(Mode || (Mode = {}));
const mode = Mode.NORMAL;
const USUAL_HEADERS = new Set([
    "accept",
    "accept-language",
    "accept-patch",
    "accept-ranges",
    "access-control-allow-credentials",
    "access-control-allow-headers",
    "access-control-allow-methods",
    "access-control-allow-origin",
    "access-control-expose-headers",
    "access-control-max-age",
    "access-control-request-headers",
    "access-control-request-method",
    "age",
    "allow",
    "alt-svc",
    "authorization",
    "cache-control",
    "connection",
    "content-disposition",
    "content-encoding",
    "content-language",
    "content-length",
    "content-location",
    "content-range",
    "content-type",
    "cookie",
    "date",
    "etag",
    "expect",
    "expires",
    "forwarded",
    "from",
    "host",
    "if-match",
    "if-modified-since",
    "if-none-match",
    "if-unmodified-since",
    "last-modified",
    "location",
    "origin",
    "pragma",
    "proxy-authenticate",
    "proxy-authorization",
    "public-key-pins",
    "range",
    "referer",
    "retry-after",
    "sec-websocket-accept",
    "sec-websocket-extensions",
    "sec-websocket-key",
    "sec-websocket-protocol",
    "sec-websocket-version",
    "set-cookie",
    "strict-transport-security",
    "tk",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "vary",
    "via",
    "warning",
    "www-authenticate",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
    "x-forwarded-scheme",
    "x-real-ip",
    "x-request-id",
    "x-scheme",
    "merrymake-key",
]);
function reply(resp, payload, contentType, statusCode, headers) {
    Object.keys(headers).forEach((k) => {
        const v = headers[k];
        v !== undefined && resp.setHeader(k, v);
    });
    if (contentType !== undefined)
        resp.contentType(contentType);
    resp.status(statusCode).send(payload);
}
class Simulator {
    pathToRoot;
    pendingReplies = {};
    channels = {};
    constructor(pathToRoot) {
        this.pathToRoot = pathToRoot;
    }
    start() {
        return new Promise((resolve) => {
            const app = express();
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
            // CORS
            app.options("*", withSession, async (req, res) => {
                res.set("Access-Control-Allow-Origin", "*");
                res.set("Access-Control-Allow-Headers", "Content-Type");
                res.send("Ok");
            });
            // NORMAL EVENTS
            app.get("/:event", withSession, (req, res) => {
                let event = req.params.event;
                let payload = Buffer.from(JSON.stringify(req.query));
                this.handleEndpoint(req, res, event, payload);
            });
            app.all("/:event", withSession, (req, res) => {
                let event = req.params.event;
                let payload = !Buffer.isBuffer(req.body)
                    ? typeof req.body === "object"
                        ? Buffer.from(JSON.stringify(req.body))
                        : Buffer.from(req.body)
                    : req.body;
                this.handleEndpoint(req, res, event, payload);
            });
            app.all("/", (req, res) => {
                res.send("Simulator ready.");
            });
            const port = 3000;
            app.listen(port, () => {
                console.log(`
${WHITE}███${GRAY}╗   ${WHITE}███${GRAY}╗${WHITE}███████${GRAY}╗${WHITE}██████${GRAY}╗ ${WHITE}██████${GRAY}╗ ${WHITE}██${GRAY}╗   ${WHITE}██${GRAY}╗${WHITE}███${GRAY}╗   ${WHITE}███${GRAY}╗ ${WHITE}█████${GRAY}╗ ${WHITE}██${GRAY}╗  ${WHITE}██${GRAY}╗${WHITE}███████${GRAY}╗
${WHITE}████${GRAY}╗ ${WHITE}████${GRAY}║${WHITE}██${GRAY}╔════╝${WHITE}██${GRAY}╔══${WHITE}██${GRAY}╗${WHITE}██${GRAY}╔══${WHITE}██${GRAY}╗╚${WHITE}██${GRAY}╗ ${WHITE}██${GRAY}╔╝${WHITE}████${GRAY}╗ ${WHITE}████${GRAY}║${WHITE}██${GRAY}╔══${WHITE}██${GRAY}╗${WHITE}██${GRAY}║ ${WHITE}██${GRAY}╔╝${WHITE}██${GRAY}╔════╝
${WHITE}██${GRAY}╔${WHITE}████${GRAY}╔${WHITE}██${GRAY}║${WHITE}█████${GRAY}╗  ${WHITE}██████${GRAY}╔╝${WHITE}██████${GRAY}╔╝ ╚${WHITE}████${GRAY}╔╝ ${WHITE}██${GRAY}╔${WHITE}████${GRAY}╔${WHITE}██${GRAY}║${WHITE}███████${GRAY}║${WHITE}█████${GRAY}╔╝ ${WHITE}█████${GRAY}╗
${WHITE}██${GRAY}║╚${WHITE}██${GRAY}╔╝${WHITE}██${GRAY}║${WHITE}██${GRAY}╔══╝  ${WHITE}██${GRAY}╔══${WHITE}██${GRAY}╗${WHITE}██${GRAY}╔══${WHITE}██${GRAY}╗  ╚${WHITE}██${GRAY}╔╝  ${WHITE}██${GRAY}║╚${WHITE}██${GRAY}╔╝${WHITE}██${GRAY}║${WHITE}██${GRAY}╔══${WHITE}██${GRAY}║${WHITE}██${GRAY}╔═${WHITE}██${GRAY}╗ ${WHITE}██${GRAY}╔══╝
${WHITE}██${GRAY}║ ╚═╝ ${WHITE}██${GRAY}║${WHITE}███████${GRAY}╗${WHITE}██${GRAY}║  ${WHITE}██${GRAY}║${WHITE}██${GRAY}║  ${WHITE}██${GRAY}║   ${WHITE}██${GRAY}║   ${WHITE}██${GRAY}║ ╚═╝ ${WHITE}██${GRAY}║${WHITE}██${GRAY}║  ${WHITE}██${GRAY}║${WHITE}██${GRAY}║  ${WHITE}██${GRAY}╗${WHITE}███████${GRAY}╗
${GRAY}╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝

Local simulator running on http://localhost:${port}/
Use ctrl+c to exit
${NORMAL_COLOR}`);
            });
        });
    }
    reply(traceId, body) {
        const rs = this.pendingReplies[traceId];
        if (rs !== undefined) {
            delete this.pendingReplies[traceId];
            reply(rs.resp, Buffer.from(body.content), body["content-type"], body["status-code"] || 200, body.headers || {});
        }
    }
    processEvent(evnt, payload, envelope) {
        const [spawn, event] = evnt[0] === "<" ? [true, evnt.substring(1)] : [false, evnt];
        // TODO spawn
        const traceId = envelope.traceId;
        if (event === "$reply") {
            const body = JSON.parse(payload.toString());
            this.reply(traceId, body);
        }
        else if (event === "$join") {
            const to = payload.toString();
            const rs = this.pendingReplies[traceId];
            if (rs !== undefined) {
                if (this.channels[to] === undefined)
                    this.channels[to] = new Set();
                this.channels[to].add(rs.resp);
                rs.channels.add(to);
            }
        }
        else if (event === "$broadcast") {
            const p = JSON.parse(payload.toString());
            const cs = this.channels[p.to] || [];
            cs.forEach((c) => {
                c.write(`event: ${p.event}\n`);
                p.payload.split("\n").forEach((x) => c.write(`data: ${x}\n`));
                c.write(`\n`);
            });
        }
        const riverConfigs = processFolders(this.pathToRoot, event);
        const rivers = Object.keys(riverConfigs);
        if (rivers.length === 0 && event[0] !== "$") {
            timedOutput(`${YELLOW}Warning: No hooks for '${event}'${NORMAL_COLOR}`, traceId);
        }
        rivers.forEach((r) => {
            const actions = riverConfigs[r];
            const action = (() => {
                if (actions.length === 1) {
                    return actions[0];
                    // } else if (mode === Mode.RECORDING) {
                    // TODO Ask user which to choose
                    // } else if (mode === Mode.PLAYING) {
                    // TODO Choose same as recording
                }
                else {
                    return actions[~~(actions.length * Math.random())];
                }
            })();
            const subEventCount = {};
            execute((event, payload) => {
                this.processEvent(event, payload, {
                    ...envelope,
                    messageId: envelope.messageId +
                        event +
                        (subEventCount[event] = (subEventCount[event] || -1) + 1),
                });
            }, this.pathToRoot, action.group, action.repo, action.action, envelope, payload);
        });
    }
    async handleEndpoint(req, resp, event, payload) {
        resp.set("Access-Control-Allow-Origin", "*");
        resp.set("Access-Control-Allow-Headers", "Content-Type");
        const headers = (() => {
            const filtered = Object.keys(req.headersDistinct).filter((k) => !USUAL_HEADERS.has(k));
            if (filtered.length === 0)
                return undefined;
            const result = {};
            filtered.forEach((k) => (result[k] = req.headersDistinct[k][0]));
            return result;
        })();
        let sessionId = req.cookies.sessionId;
        if (!sessionId) {
            sessionId = "s" + Math.random();
            resp.cookie("sessionId", sessionId);
        }
        const api_json = JSON.parse(fs.readFileSync(this.pathToRoot.with("event-catalogue").with("api.json").toString(), "utf-8"));
        const conf = api_json[event];
        const traceId = generateString(3, all);
        this.pendingReplies[traceId] = {
            resp,
            channels: new Set(),
        };
        if (conf !== undefined && conf.waitFor !== undefined) {
            setTimeout(() => {
                timedOutput(`Reply timeout for trace${NORMAL_COLOR}`, traceId);
            }, conf.waitFor);
        }
        if (conf !== undefined && conf.streaming === true) {
            req.on("close", () => {
                const rep = this.pendingReplies[traceId];
                rep.channels.forEach((c) => {
                    this.channels[c].delete(rep.resp);
                    if (this.channels[c].size === 0) {
                        delete this.channels[c];
                    }
                });
            });
            resp.set("Content-Type", "text/event-stream");
            resp.set("Cache-Control", "no-cache");
            resp.set("Connection", "keep-alive");
            resp.flushHeaders();
        }
        const envelope = {
            messageId: "m" + Math.random(),
            traceId,
            sessionId,
            headers,
        };
        this.processEvent(event, payload, envelope);
    }
}
export function do_startSimulator(pathToRoot) {
    const sim = new Simulator(pathToRoot);
    addToExecuteQueue(() => sim.start());
    return finish();
}
