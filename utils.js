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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Path = void 0;
exports.getFiles = getFiles;
exports.setDryrun = setDryrun;
exports.addToExecuteQueue = addToExecuteQueue;
exports.addExitMessage = addExitMessage;
exports.abort = abort;
exports.finish = finish;
exports.TODO = TODO;
exports.getCache = getCache;
exports.saveCache = saveCache;
exports.fetchOrgRaw = fetchOrgRaw;
exports.fetchOrg = fetchOrg;
exports.output2 = output2;
exports.execPromise = execPromise;
exports.checkVersion = checkVersion;
exports.typedKeys = typedKeys;
exports.execStreamPromise = execStreamPromise;
exports.spawnPromise = spawnPromise;
exports.sshReq = sshReq;
exports.partition = partition;
exports.urlReq = urlReq;
exports.directoryNames = directoryNames;
exports.toFolderName = toFolderName;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const node_fs_1 = require("node:fs");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const conf = __importStar(require("./package.json"));
const prompt_1 = require("./prompt");
class Path {
    constructor(offset = ".") {
        this.offset = offset;
        let end = this.offset.length;
        while (this.offset.charAt(end - 1) === "/")
            end--;
        this.offset = this.offset.substring(0, end);
        if (this.offset.length === 0)
            this.offset = ".";
    }
    with(next) {
        return new Path(path_1.default.join(this.offset, next));
    }
    withoutLastUp() {
        return new Path(this.offset.substring(0, this.offset.lastIndexOf("..")));
    }
    toString() {
        return this.offset;
    }
}
exports.Path = Path;
function getFiles(path) {
    return getFiles_internal(path, "");
}
function getFiles_internal(path, prefix) {
    if (!fs_1.default.existsSync(path.toString()))
        return [];
    return (0, node_fs_1.readdirSync)(path.toString(), { withFileTypes: true }).flatMap((x) => x.isDirectory()
        ? getFiles_internal(path.with(x.name), prefix + x.name + "/")
        : [prefix + x.name]);
}
const toExecute = [];
let dryrun = false;
function setDryrun() {
    output2(`${prompt_1.BLUE}Dryrun mode, changes will not be performed.${prompt_1.NORMAL_COLOR}`);
    dryrun = true;
}
function addToExecuteQueue(f) {
    if (!dryrun)
        toExecute.push(f);
}
let printOnExit = [];
function addExitMessage(str) {
    printOnExit.push(str);
}
function printExitMessages() {
    printOnExit.forEach((x) => (0, prompt_1.output)(x + "\n"));
}
function abort() {
    (0, prompt_1.exit)();
    printExitMessages();
    process.exit(0);
}
function finish() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, prompt_1.exit)();
            for (let i = 0; i < toExecute.length; i++) {
                yield toExecute[i]();
            }
            printExitMessages();
            process.exit(0);
        }
        catch (e) {
            console.log("finish");
            throw e;
        }
    });
}
function TODO() {
    console.log("TODO");
    (0, prompt_1.exit)();
    process.exit(0);
}
function getCache() {
    if (!fs_1.default.existsSync(`${historyFolder}cache`)) {
        return { registered: false, hasOrgs: false };
    }
    return JSON.parse(fs_1.default.readFileSync(`${historyFolder}cache`).toString());
}
function saveCache(cache) {
    fs_1.default.writeFileSync(`${historyFolder}cache`, JSON.stringify(cache));
}
function fetchOrgRaw() {
    if (fs_1.default.existsSync(path_1.default.join(".merrymake", "conf.json"))) {
        const org = JSON.parse("" + fs_1.default.readFileSync(path_1.default.join(".merrymake", "conf.json")));
        return { org, serviceGroup: null, pathToRoot: "." + path_1.default.sep };
    }
    const cwd = process.cwd().split(/\/|\\/);
    let out = "";
    let folder = path_1.default.sep;
    let serviceGroup = null;
    for (let i = cwd.length - 1; i >= 0; i--) {
        if (fs_1.default.existsSync(out + path_1.default.join("..", ".merrymake", "conf.json"))) {
            serviceGroup = cwd[i];
            const org = (JSON.parse("" + fs_1.default.readFileSync(path_1.default.join(`${out}..`, `.merrymake`, `conf.json`))));
            return { org, serviceGroup, pathToRoot: out + ".." + path_1.default.sep };
        }
        folder = path_1.default.sep + cwd[i] + folder;
        out += ".." + path_1.default.sep;
    }
    return { org: null, serviceGroup: null, pathToRoot: null };
}
function fetchOrg() {
    const res = fetchOrgRaw();
    if (res.org === null)
        throw "Not inside a Merrymake organization";
    return res;
}
function output2(str) {
    console.log((str || "")
        .trimEnd()
        .split("\n")
        .map((x) => x.trimEnd())
        .join("\n"));
}
function versionIsOlder(old, new_) {
    const os = old.split(".");
    const ns = new_.split(".");
    if (+os[0] < +ns[0])
        return true;
    else if (+os[0] > +ns[0])
        return false;
    else if (+os[1] < +ns[1])
        return true;
    else if (+os[1] > +ns[1])
        return false;
    else if (+os[2] < +ns[2])
        return true;
    return false;
}
function execPromise(cmd, cwd) {
    return new Promise((resolve, reject) => {
        const a = (0, child_process_1.exec)(cmd, { cwd }, (error, stdout, stderr) => {
            const err = (error === null || error === void 0 ? void 0 : error.message) || stderr;
            if (err) {
                reject(stderr || stdout);
            }
            else {
                resolve(stdout);
            }
        });
    });
}
const historyFolder = os_1.default.homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
function checkVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs_1.default.existsSync(historyFolder))
            fs_1.default.mkdirSync(historyFolder);
        const lastCheck = fs_1.default.existsSync(historyFolder + updateFile)
            ? +fs_1.default.readFileSync(historyFolder + updateFile).toString()
            : 0;
        if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
            try {
                const call = yield execPromise("npm show @merrymake/cli dist-tags --json");
                const version = JSON.parse(call);
                if (versionIsOlder(conf.version, version.latest)) {
                    addExitMessage(`
New version of merrymake-cli available, ${process.env["UPDATE_MESSAGE"]}`);
                }
            }
            catch (e) { }
            fs_1.default.writeFileSync(historyFolder + updateFile, "" + Date.now());
        }
    });
}
function typedKeys(o) {
    return Object.keys(o);
}
function execStreamPromise(full, onData, cwd) {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = full.split(" ");
        const p = (0, child_process_1.spawn)(cmd, args, { cwd, shell: "sh" });
        p.stdout.on("data", (data) => {
            onData(data.toString());
        });
        p.stderr.on("data", (data) => {
            console.log(data.toString());
        });
        p.on("exit", (code) => {
            if (code !== 0)
                reject();
            else
                resolve();
        });
    });
}
function spawnPromise(str) {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = str.split(" ");
        const options = {
            cwd: ".",
            shell: "sh",
        };
        const ls = (0, child_process_1.spawn)(cmd, args, options);
        ls.stdout.on("data", (data) => {
            output2(data.toString());
        });
        ls.stderr.on("data", (data) => {
            output2(data.toString());
        });
        ls.on("close", (code) => {
            if (code === 0)
                resolve();
            else
                reject();
        });
    });
}
function sshReqInternal(cmd) {
    return execPromise(`ssh -o ConnectTimeout=10 mist@${config_1.SSH_HOST} "${cmd}"`);
}
function sshReq(...cmd) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, prompt_1.spinner_start)();
            const result = yield sshReqInternal(cmd
                .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
                .join(" "));
            (0, prompt_1.spinner_stop)();
            return result;
        }
        catch (e) {
            throw e;
        }
    });
}
function partition(str, radix) {
    const index = str.indexOf(radix);
    if (index < 0)
        return [str, ""];
    return [str.substring(0, index), str.substring(index + radix.length)];
}
function urlReq(url, method = "GET", data, contentType = "application/json") {
    return new Promise((resolve, reject) => {
        const [protocol, fullPath] = url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
        const [base, path] = partition(fullPath, "/");
        const [host, port] = partition(base, ":");
        let headers;
        if (data !== undefined)
            headers = {
                "Content-Type": contentType,
                "Content-Length": data.length,
            };
        const sender = protocol === "http" ? http_1.default : https_1.default;
        const req = sender.request({
            host,
            port,
            path: "/" + path,
            method,
            headers,
        }, (resp) => {
            let str = "";
            resp.on("data", (chunk) => {
                str += chunk;
            });
            resp.on("end", () => {
                resolve({ body: str, code: resp.statusCode });
            });
        });
        req.on("error", (e) => {
            reject(`Unable to connect to ${host}. Please verify your internet connection.`);
        });
        if (data !== undefined)
            req.write(data);
        req.end();
    });
}
function directoryNames(path, exclude) {
    if (!fs_1.default.existsSync(path.toString()))
        return [];
    return fs_1.default
        .readdirSync(path.toString(), { withFileTypes: true })
        .filter((x) => x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith("."));
}
function toFolderName(str) {
    return str.toLowerCase().replace(/[^a-z0-9\-_]/g, "-");
}
