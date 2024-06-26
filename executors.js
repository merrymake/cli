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
exports.do_delete_org = exports.do_delete_group = exports.do_spending = exports.do_help = exports.printTableHeader = exports.alignLeft = exports.alignRight = exports.do_build = exports.SPECIAL_FOLDERS = void 0;
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
const detect_project_type_1 = require("@merrymake/detect-project-type");
const child_process_1 = require("child_process");
const prompt_1 = require("./prompt");
const args_1 = require("./args");
const process_1 = require("process");
exports.SPECIAL_FOLDERS = ["event-catalogue", "public"];
function spawnPromise(str) {
    return new Promise((resolve, reject) => {
        let [cmd, ...args] = str.split(" ");
        const options = {
            cwd: ".",
            shell: "sh",
        };
        let ls = (0, child_process_1.spawn)(cmd, args, options);
        ls.stdout.on("data", (data) => {
            (0, utils_1.output2)(data.toString());
        });
        ls.stderr.on("data", (data) => {
            (0, utils_1.output2)(data.toString());
        });
        ls.on("close", (code) => {
            if (code === 0)
                resolve();
            else
                reject();
        });
    });
}
function do_build() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let projectType = (0, detect_project_type_1.detectProjectType)(".");
            (0, utils_1.output2)(`Building ${projectType} project...`);
            let buildCommands = detect_project_type_1.BUILD_SCRIPT_MAKERS[projectType](".");
            for (let i = 0; i < buildCommands.length; i++) {
                let x = buildCommands[i];
                yield spawnPromise(x);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_build = do_build;
function alignRight(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padStart(width, " ");
}
exports.alignRight = alignRight;
function alignLeft(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padEnd(width, " ");
}
exports.alignLeft = alignLeft;
function printTableHeader(prefix, widths) {
    if ((0, args_1.getArgs)().length > 0)
        return "";
    let totalWidth = process_1.stdout.getWindowSize()[0] - prefix.length;
    let vals = Object.values(widths);
    let rest = totalWidth -
        vals.reduce((acc, x) => acc + Math.max(x, 0)) -
        3 * (vals.length - 1);
    let header = prefix +
        Object.keys(widths)
            .map((k) => k.trim().padEnd(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k]))
            .join(" │ ");
    let result = header + "\n";
    let divider = prefix +
        Object.keys(widths)
            .map((k) => "─".repeat(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k]))
            .join("─┼─");
    result += divider;
    return result;
}
exports.printTableHeader = printTableHeader;
function do_help() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, utils_1.urlReq)("https://google.com");
        }
        catch (e) {
            (0, utils_1.output2)(`${prompt_1.RED}No internet connection.${prompt_1.NORMAL_COLOR}`);
            return;
        }
        let whoami = JSON.parse(yield (0, utils_1.sshReq)("me-whoami"));
        if (whoami === undefined || whoami.length === 0) {
            let cache = (0, utils_1.getCache)();
            if (!cache.registered) {
                (0, utils_1.output2)(`${prompt_1.YELLOW}No key registered with ${process.env["COMMAND"]}.${prompt_1.NORMAL_COLOR}`);
            }
            (0, utils_1.output2)(`${prompt_1.RED}No verified email.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Logged in as: ${whoami.join(", ")}.${prompt_1.NORMAL_COLOR}`);
        }
        let rawStruct = (0, utils_1.fetchOrgRaw)();
        if (rawStruct.org === null) {
            (0, utils_1.output2)(`${prompt_1.YELLOW}Not inside organization.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Inside organization: ${rawStruct.org.name}${prompt_1.NORMAL_COLOR}`);
        }
        if (rawStruct.serviceGroup === null) {
            (0, utils_1.output2)(`${prompt_1.YELLOW}Not inside service group.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Inside service group: ${rawStruct.serviceGroup}${prompt_1.NORMAL_COLOR}`);
        }
        if (!fs_1.default.existsSync("merrymake.json")) {
            (0, utils_1.output2)(`${prompt_1.YELLOW}Not inside service repo.${prompt_1.NORMAL_COLOR}`);
        }
        else {
            (0, utils_1.output2)(`${prompt_1.GREEN}Inside service repo.${prompt_1.NORMAL_COLOR}`);
        }
    });
}
exports.do_help = do_help;
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
function do_spending(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let rows = JSON.parse(yield (0, utils_1.sshReq)(`spending`, `--org`, org));
            let mth = 0;
            let grp = "";
            let srv = "";
            rows.forEach((x) => {
                if (x.mth === null)
                    return;
                let nmth = +x.mth;
                if (mth !== nmth) {
                    if (mth !== 0)
                        (0, utils_1.output2)("");
                    mth = nmth;
                    (0, utils_1.output2)(`Month: ${MONTHS[mth - 1]}`);
                    printTableHeader("", {
                        Group: 11,
                        Service: 11,
                        Hook: 20,
                        Count: 7,
                        Time: 7,
                        "Est. Cost": 9,
                    });
                }
                let group = x.grp === null ? "= Total" : x.grp === grp ? "" : x.grp;
                grp = x.grp;
                let service = x.grp === null
                    ? ""
                    : x.srv === null
                        ? "= Total"
                        : x.srv === srv
                            ? ""
                            : x.srv;
                srv = x.srv;
                let count = +x.cnt;
                let count_unit = " ";
                let count_str = "" + count + "  ";
                if (count > 1000) {
                    count /= 1000;
                    count_unit = "k";
                    if (count > 1000) {
                        count /= 1000;
                        count_unit = "M";
                        if (count > 1000) {
                            count /= 1000;
                            count_unit = "B";
                        }
                    }
                    count_str = count.toFixed(1);
                }
                let time = x.time_ms;
                let time_unit = "ms";
                let time_str = "" + time + " ";
                if (time > 1000) {
                    time /= 1000;
                    time_unit = "s";
                    if (time > 60) {
                        time /= 60;
                        time_unit = "m";
                        if (time > 60) {
                            time /= 60;
                            time_unit = "h";
                            if (time > 24) {
                                time /= 24;
                                time_unit = "d";
                                if (time > 30) {
                                    time /= 30;
                                    time_unit = "M";
                                }
                            }
                        }
                    }
                    time_str = time.toFixed(1);
                }
                let hook = x.srv === null ? "" : x.hook === null ? "= Total" : x.hook;
                (0, utils_1.output2)(`${alignLeft(group, 11)} │ ${alignLeft(service, 11)} │ ${alignLeft(hook, 20)} │ ${alignRight("" + count_str + " " + count_unit, 7)} │ ${alignRight("" + time_str + " " + time_unit, 7)} │ € ${alignRight(x.cost_eur, 7)}`);
            });
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_spending = do_spending;
function do_delete_group(org, group) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`team`, `--delete`, `--org`, org, group));
            if (fs_1.default.existsSync(group))
                fs_1.default.renameSync(group, `(deleted) ${group}`);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_delete_group = do_delete_group;
function do_delete_org(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`org`, `--delete`, org));
            if (fs_1.default.existsSync(org))
                fs_1.default.renameSync(org, `(deleted) ${org}`);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_delete_org = do_delete_org;
