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
exports.redeploy = exports.deploy = exports.do_redeploy = exports.do_deploy = void 0;
const prompt_1 = require("../prompt");
const types_1 = require("../types");
const utils_1 = require("../utils");
function do_deploy_internal(commit) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = [];
            const onData = (s) => {
                result.push(s);
                (0, utils_1.output2)(s);
            };
            yield (0, utils_1.execStreamPromise)(`git add -A && ${commit} && git push origin HEAD 2>&1`, onData);
            return result.join("");
        }
        catch (e) {
            throw e;
        }
    });
}
function do_deploy(pathToService) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const before = process.cwd();
            process.chdir(pathToService.toString());
            const output = yield do_deploy_internal("(git diff-index --quiet HEAD 2>/dev/null || git commit -m 'Deploy')");
            process.chdir(before);
            return !output.startsWith("Everything up-to-date");
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_deploy = do_deploy;
function do_redeploy() {
    return do_deploy_internal("git commit --allow-empty -m 'Redeploy'");
}
exports.do_redeploy = do_redeploy;
function deploy() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const didDeploy = yield do_deploy(new types_1.PathToRepository("."));
            if (didDeploy)
                return (0, utils_1.finish)();
            else
                return (0, prompt_1.choice)("Would you like to redeploy?", [
                    {
                        long: "again",
                        text: "deploy again",
                        action: () => redeploy(),
                    },
                ], { disableAutoPick: true });
        }
        catch (e) {
            throw e;
        }
    });
}
exports.deploy = deploy;
function redeploy() {
    (0, utils_1.addToExecuteQueue)(() => do_redeploy());
    return (0, utils_1.finish)();
}
exports.redeploy = redeploy;
