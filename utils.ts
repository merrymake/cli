import { exec, spawn } from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
import { readdirSync } from "node:fs";
import path from "path";
import { SSH_HOST, SSH_USER } from "./config.js";
import { Str } from "@merrymake/utils";
import { PathTo } from "./types.js";

export const lowercase = "abcdefghijklmnopqrstuvwxyz";
export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const digits = "0123456789";
export const underscore = "_";
export const dash = "-";
export const all = lowercase + uppercase + digits + underscore + dash;
export function generateString(
  length: number,
  ...alphabets: [string, ...string[]]
) {
  const alphabet = alphabets.join("");
  const result = new Array(length);
  for (let i = 0; i < length; i++) {
    result.push(alphabet.charAt(Math.floor(Math.random() * alphabet.length)));
  }
  return result.join("");
}

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

export function getFiles(path: PathTo): string[] {
  return getFiles_internal(path, "");
}

function getFiles_internal(path: PathTo, prefix: string): string[] {
  if (!fs.existsSync(path.toString())) return [];
  return readdirSync(path.toString(), { withFileTypes: true }).flatMap((x) =>
    x.isDirectory()
      ? getFiles_internal(path.with(x.name), prefix + x.name + "/")
      : [prefix + x.name]
  );
}

export interface OrgFile {
  organizationId: string;
}

export function fetchOrgRaw() {
  if (fs.existsSync(path.join(".merrymake", "conf.json"))) {
    const org: OrgFile = JSON.parse(
      "" + fs.readFileSync(path.join(".merrymake", "conf.json"))
    );
    return { org, serviceGroup: null, pathToRoot: "." + path.sep };
  }

  const cwd = process.cwd().split(/\/|\\/);
  let out = "";
  let folder = path.sep;
  let serviceGroup: string | null = null;
  for (let i = cwd.length - 1; i >= 0; i--) {
    if (fs.existsSync(out + path.join("..", ".merrymake", "conf.json"))) {
      serviceGroup = cwd[i];
      const org = <OrgFile>(
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
  const res = fetchOrgRaw();
  if (res.org === null) throw "Not inside a Merrymake organization";
  return res;
}

const BYTES = 1;
const KILOBYTES = 1024 * BYTES;
const MEGABYTES = 1024 * KILOBYTES;
const GIGABYTES = 1024 * MEGABYTES;
const TERABYTES = 1024 * GIGABYTES;
const PETABYTES = 1024 * TERABYTES;
const EXABYTES = 1024 * PETABYTES;

export function execPromise(cmd: string, cwd?: string) {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, { cwd, maxBuffer: 10 * MEGABYTES }, (error, stdout, stderr) => {
      const err = error?.message || stderr;
      if (err) {
        reject(stderr || stdout);
      } else {
        resolve(stdout);
      }
    });
  });
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
    const [cmd, ...args] = full.split(" ");
    const p = spawn(cmd, args, { cwd, shell: "sh" });
    p.stdout.on("data", (data) => {
      onData(data.toString());
    });
    p.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    p.on("exit", (code) => {
      if (code !== 0) reject("subprocess failed");
      else resolve();
    });
  });
}

function sshReqInternal(cmd: string) {
  return execPromise(
    `ssh -o ConnectTimeout=10 ${SSH_USER}@${SSH_HOST} "${cmd}"`
  );
}
export async function sshReq(...cmd: string[]) {
  const spinner =
    typeof process.stdout.moveCursor === "function"
      ? Str.Spinner.start()
      : undefined;
  try {
    const result = await sshReqInternal(
      cmd
        .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
        .join(" ")
    );
    return result;
  } catch (e) {
    throw e;
  } finally {
    spinner?.stop();
  }
}

export function partition(str: string, radix: string) {
  const index = str.indexOf(radix);
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
      const [protocol, fullPath] =
        url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
      const [base, path] = partition(fullPath, "/");
      const [host, port] = partition(base, ":");
      let headers;
      if (data !== undefined)
        headers = {
          "Content-Type": contentType,
          "Content-Length": data.length,
        };
      const sender = protocol === "http" ? http : https;
      const req = sender.request(
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

export function directoryNames(path: PathTo, exclude: string[]) {
  if (!fs.existsSync(path.toString())) return [];
  return fs
    .readdirSync(path.toString(), { withFileTypes: true })
    .filter(
      (x) =>
        x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith(".")
    );
}

export function toFolderName(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9\-_]/g, "-");
}

export function toSubdomain(displayName: string) {
  return displayName
    .toLowerCase()
    .replace(/[ _]/g, "-")
    .replace(/[^a-z0-9\-]/g, ""); // Remove special characters
}
