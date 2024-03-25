import http from "http";
import https from "https";
import { SSH_HOST } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { exec, spawn } from "child_process";
import { readdirSync } from "node:fs";
import * as conf from "./package.json";
import {
  YELLOW,
  NORMAL_COLOR,
  exit,
  spinner_start,
  spinner_stop,
  output,
  BLUE,
} from "./prompt";

export class Path {
  constructor(private offset = ".") {
    let end = this.offset.length;
    while (this.offset.charAt(end - 1) === "/") end--;
    this.offset = this.offset.substring(0, end);
    if (this.offset.length === 0) this.offset = ".";
  }
  with(next: string) {
    return new Path(path.join(this.offset, next));
  }
  withoutLastUp() {
    return new Path(this.offset.substring(0, this.offset.lastIndexOf("..")));
  }
  toString() {
    return this.offset;
  }
}

export function getFiles(path: Path): string[] {
  return getFiles_internal(path, "");
}

function getFiles_internal(path: Path, prefix: string): string[] {
  if (!fs.existsSync(path.toString())) return [];
  return readdirSync(path.toString(), { withFileTypes: true }).flatMap((x) =>
    x.isDirectory()
      ? getFiles_internal(path.with(x.name), prefix + x.name + "/")
      : [prefix + x.name]
  );
}

const toExecute: (() => void)[] = [];
let dryrun = false;

export function setDryrun() {
  output2(`${BLUE}Dryrun mode, changes will not be performed.${NORMAL_COLOR}`);
  dryrun = true;
}
export function addToExecuteQueue(f: () => void) {
  if (!dryrun) toExecute.push(f);
}

let printOnExit: string[] = [];
export function addExitMessage(str: string) {
  printOnExit.push(str);
}
function printExitMessages() {
  printOnExit.forEach((x) => output(x + "\n"));
}
export function abort(): never {
  exit();
  printExitMessages();
  process.exit(0);
}
export async function finish(): Promise<never> {
  try {
    exit();
    for (let i = 0; i < toExecute.length; i++) {
      await toExecute[i]();
    }
    printExitMessages();
    process.exit(0);
  } catch (e) {
    throw e;
  }
}
export function TODO(): never {
  console.log("TODO");
  exit();
  process.exit(0);
}

export interface OrgFile {
  name: string;
}
interface CacheFile {
  registered: boolean;
  hasOrgs: boolean;
}

export function getCache(): CacheFile {
  if (!fs.existsSync(`${historyFolder}cache`)) {
    return { registered: false, hasOrgs: false };
  }
  return JSON.parse(fs.readFileSync(`${historyFolder}cache`).toString());
}
export function saveCache(cache: CacheFile) {
  fs.writeFileSync(`${historyFolder}cache`, JSON.stringify(cache));
}

export function fetchOrgRaw() {
  if (fs.existsSync(path.join(".mist", "conf.json"))) {
    let org: OrgFile = JSON.parse(
      "" + fs.readFileSync(path.join(".mist", "conf.json"))
    );
    return { org, serviceGroup: null, pathToRoot: "." + path.sep };
  }
  if (fs.existsSync(path.join(".merrymake", "conf.json"))) {
    let org: OrgFile = JSON.parse(
      "" + fs.readFileSync(path.join(".merrymake", "conf.json"))
    );
    return { org, serviceGroup: null, pathToRoot: "." + path.sep };
  }

  let cwd = process.cwd().split(/\/|\\/);
  let out = "";
  let folder = path.sep;
  let serviceGroup: string | null = null;
  for (let i = cwd.length - 1; i >= 0; i--) {
    if (fs.existsSync(out + path.join("..", ".mist", "conf.json"))) {
      serviceGroup = cwd[i];
      let org = <OrgFile>(
        JSON.parse(
          "" + fs.readFileSync(path.join(`${out}..`, `.mist`, `conf.json`))
        )
      );
      return { org, serviceGroup, pathToRoot: out + ".." + path.sep };
    }
    if (fs.existsSync(out + path.join("..", ".merrymake", "conf.json"))) {
      serviceGroup = cwd[i];
      let org = <OrgFile>(
        JSON.parse(
          "" + fs.readFileSync(path.join(`${out}..`, `.merrymake`, `conf.json`))
        )
      );
      return { org, serviceGroup, pathToRoot: out + ".." + path.sep };
    }
    folder = path.sep + cwd[i] + folder;
    out += ".." + path.sep;
  }
  return { org: null, serviceGroup: null, pathToRoot: null };
}
export function fetchOrg() {
  let res = fetchOrgRaw();
  if (res.org === null) throw "Not inside a Merrymake organization";
  return res;
}
export function output2(str: string) {
  console.log(
    (str || "")
      .trimEnd()
      .split("\n")
      .map((x) => x.trimEnd())
      .join("\n")
  );
}

function versionIsOlder(old: string, new_: string) {
  let os = old.split(".");
  let ns = new_.split(".");
  if (+os[0] < +ns[0]) return true;
  else if (+os[0] > +ns[0]) return false;
  else if (+os[1] < +ns[1]) return true;
  else if (+os[1] > +ns[1]) return false;
  else if (+os[2] < +ns[2]) return true;
  return false;
}

export function execPromise(cmd: string, cwd?: string) {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      let err = error?.message || stderr;
      if (err) {
        reject(stderr || stdout);
      } else {
        resolve(stdout);
      }
    });
  });
}

const historyFolder = os.homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
export async function checkVersion() {
  if (!fs.existsSync(historyFolder)) fs.mkdirSync(historyFolder);
  let lastCheck = fs.existsSync(historyFolder + updateFile)
    ? +fs.readFileSync(historyFolder + updateFile).toString()
    : 0;
  if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
    try {
      let call = await execPromise("npm show @merrymake/cli dist-tags --json");
      let version: { latest: string } = JSON.parse(call);
      if (versionIsOlder(conf.version, version.latest)) {
        addExitMessage(`
New version of merrymake-cli available, ${process.env["UPDATE_MESSAGE"]}`);
      }
    } catch (e) {}
    fs.writeFileSync(historyFolder + updateFile, "" + Date.now());
  }
}

export function typedKeys<T extends object>(o: T): Array<keyof T> {
  return Object.keys(o) as any;
}

export function execStreamPromise(
  full: string,
  onData: (_: string) => void,
  cwd?: string
) {
  return new Promise<void>((resolve, reject) => {
    let [cmd, ...args] = full.split(" ");
    let p = spawn(cmd, args, { cwd, shell: "sh" });
    p.stdout.on("data", (data) => {
      onData(data.toString());
    });
    p.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    p.on("exit", (code) => {
      if (code !== 0) reject();
      else resolve();
    });
  });
}

function sshReqInternal(cmd: string) {
  return execPromise(`ssh -o ConnectTimeout=10 mist@${SSH_HOST} "${cmd}"`);
}
export async function sshReq(...cmd: string[]) {
  try {
    spinner_start();
    let result = await sshReqInternal(
      cmd
        .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
        .join(" ")
    );
    spinner_stop();
    return result;
  } catch (e) {
    throw e;
  }
}

export function partition(str: string, radix: string) {
  let index = str.indexOf(radix);
  if (index < 0) return [str, ""];
  return [str.substring(0, index), str.substring(index + radix.length)];
}

export function urlReq(
  url: string,
  method: "POST" | "GET" = "GET",
  data?: string,
  contentType = "application/json"
) {
  return new Promise<{ body: string; code: number | undefined }>(
    (resolve, reject) => {
      let [protocol, fullPath] =
        url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
      let [base, path] = partition(fullPath, "/");
      let [host, port] = partition(base, ":");
      let headers;
      if (data !== undefined)
        headers = {
          "Content-Type": contentType,
          "Content-Length": data.length,
        };
      let sender = protocol === "http" ? http : https;
      let req = sender.request(
        {
          host,
          port,
          path: "/" + path,
          method,
          headers,
        },
        (resp) => {
          let str = "";
          resp.on("data", (chunk) => {
            str += chunk;
          });
          resp.on("end", () => {
            resolve({ body: str, code: resp.statusCode });
          });
        }
      );
      req.on("error", (e) => {
        reject(
          `Unable to connect to ${host}. Please verify your internet connection.`
        );
      });
      if (data !== undefined) req.write(data);
      req.end();
    }
  );
}

export function directoryNames(path: Path, exclude: string[]) {
  if (!fs.existsSync(path.toString())) return [];
  return fs
    .readdirSync(path.toString(), { withFileTypes: true })
    .filter(
      (x) =>
        x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith(".")
    );
}
