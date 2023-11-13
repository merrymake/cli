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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.directoryNames = exports.urlReq = exports.partition = exports.sshReq = exports.execStreamPromise = exports.typedKeys = exports.checkVersion = exports.execPromise = exports.output2 = exports.fetchOrg = exports.fetchOrgRaw = exports.saveCache = exports.getCache = exports.TODO = exports.finish = exports.abort = exports.addExitMessage = exports.addToExecuteQueue = exports.setDryrun = exports.getFiles = exports.Path = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const config_1 = require("./config");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const node_fs_1 = require("node:fs");
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
function getFiles(path, prefix) {
    return (0, node_fs_1.readdirSync)(path.toString(), { withFileTypes: true }).flatMap((x) => x.isDirectory()
        ? getFiles(path.with(x.name), prefix + x.name + "/")
        : [prefix + x.name]);
}
exports.getFiles = getFiles;
const toExecute = [];
let dryrun = false;
function setDryrun() {
    dryrun = true;
}
exports.setDryrun = setDryrun;
function addToExecuteQueue(f) {
    if (!dryrun)
        toExecute.push(f);
}
exports.addToExecuteQueue = addToExecuteQueue;
let printOnExit = [];
function addExitMessage(str) {
    printOnExit.push(str);
}
exports.addExitMessage = addExitMessage;
function printExitMessages() {
    printOnExit.forEach((x) => console.log(x));
}
function abort() {
    (0, prompt_1.exit)();
    printExitMessages();
    process.exit(0);
}
exports.abort = abort;
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
            throw e;
        }
    });
}
exports.finish = finish;
function TODO() {
    console.log("TODO");
    (0, prompt_1.exit)();
    process.exit(0);
}
exports.TODO = TODO;
function getCache() {
    if (!fs_1.default.existsSync(`${historyFolder}cache`)) {
        return { registered: false, hasOrgs: false };
    }
    return JSON.parse(fs_1.default.readFileSync(`${historyFolder}cache`).toString());
}
exports.getCache = getCache;
function saveCache(cache) {
    fs_1.default.writeFileSync(`${historyFolder}cache`, JSON.stringify(cache));
}
exports.saveCache = saveCache;
function fetchOrgRaw() {
    if (fs_1.default.existsSync(".mist/conf.json")) {
        let org = JSON.parse("" + fs_1.default.readFileSync(`.mist/conf.json`));
        return { org, serviceGroup: null, pathToRoot: "./" };
    }
    if (fs_1.default.existsSync(".merrymake/conf.json")) {
        let org = JSON.parse("" + fs_1.default.readFileSync(`.merrymake/conf.json`));
        return { org, serviceGroup: null, pathToRoot: "./" };
    }
    let cwd = process.cwd().split(/\/|\\/);
    let out = "";
    let folder = "/";
    let serviceGroup = null;
    for (let i = cwd.length - 1; i >= 0; i--) {
        if (fs_1.default.existsSync(out + "../.mist/conf.json")) {
            serviceGroup = cwd[i];
            let org = (JSON.parse("" + fs_1.default.readFileSync(`${out}../.mist/conf.json`)));
            return { org, serviceGroup, pathToRoot: out + "../" };
        }
        if (fs_1.default.existsSync(out + "../.merrymake/conf.json")) {
            serviceGroup = cwd[i];
            let org = (JSON.parse("" + fs_1.default.readFileSync(`${out}../.merrymake/conf.json`)));
            return { org, serviceGroup, pathToRoot: out + "../" };
        }
        folder = "/" + cwd[i] + folder;
        out += "../";
    }
    return { org: null, serviceGroup: null, pathToRoot: null };
}
exports.fetchOrgRaw = fetchOrgRaw;
function fetchOrg() {
    let res = fetchOrgRaw();
    if (res.org === null)
        throw "Not inside a Merrymake organization";
    return res;
}
exports.fetchOrg = fetchOrg;
function output2(str) {
    console.log((str || "")
        .trimEnd()
        .split("\n")
        .map((x) => x.trimEnd())
        .join("\n"));
}
exports.output2 = output2;
function versionIsOlder(old, new_) {
    let os = old.split(".");
    let ns = new_.split(".");
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
    // output("Executing", cmd);
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(cmd, { cwd }, (error, stdout, stderr) => {
            let err = (error === null || error === void 0 ? void 0 : error.message) || stderr;
            if (err) {
                reject(stderr || stdout);
            }
            else {
                resolve(stdout);
            }
        });
    });
}
exports.execPromise = execPromise;
const historyFolder = os_1.default.homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
function checkVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs_1.default.existsSync(historyFolder))
            fs_1.default.mkdirSync(historyFolder);
        let lastCheck = fs_1.default.existsSync(historyFolder + updateFile)
            ? +fs_1.default.readFileSync(historyFolder + updateFile).toString()
            : 0;
        if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
            try {
                let call = yield execPromise("npm show @merrymake/cli dist-tags --json");
                let version = JSON.parse(call);
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
exports.checkVersion = checkVersion;
function typedKeys(o) {
    return Object.keys(o);
}
exports.typedKeys = typedKeys;
function execStreamPromise(full, onData, cwd) {
    return new Promise((resolve, reject) => {
        let [cmd, ...args] = full.split(" ");
        let p = (0, child_process_1.spawn)(cmd, args, { cwd, shell: "sh" });
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
exports.execStreamPromise = execStreamPromise;
function sshReqInternal(cmd) {
    return execPromise(`ssh mist@${config_1.SSH_HOST} "${cmd}"`);
}
function sshReq(...cmd) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, prompt_1.spinner_start)();
            let result = yield sshReqInternal(cmd
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
exports.sshReq = sshReq;
function partition(str, radix) {
    let index = str.indexOf(radix);
    if (index < 0)
        return [str, ""];
    return [str.substring(0, index), str.substring(index + radix.length)];
}
exports.partition = partition;
function urlReq(url, method = "GET", body) {
    return new Promise((resolve, reject) => {
        let [protocol, fullPath] = url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
        let [base, path] = partition(fullPath, "/");
        let [host, port] = partition(base, ":");
        let data = JSON.stringify(body);
        let headers;
        if (body !== undefined)
            headers = {
                "Content-Type": "application/json",
                "Content-Length": data.length,
            };
        let sender = protocol === "http" ? http_1.default : https_1.default;
        let req = sender.request({
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
exports.urlReq = urlReq;
function directoryNames(path, exclude) {
    if (!fs_1.default.existsSync(path.toString()))
        return [];
    return fs_1.default
        .readdirSync(path.toString(), { withFileTypes: true })
        .filter((x) => x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith("."));
}
exports.directoryNames = directoryNames;
