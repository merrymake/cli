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
exports.do_build = do_build;
exports.build = build;
const detect_project_type_1 = require("@merrymake/detect-project-type");
const utils_1 = require("../utils");
function do_build() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const projectType = (0, detect_project_type_1.detectProjectType)(".");
            (0, utils_1.output2)(`Building ${projectType} project...`);
            const buildCommands = detect_project_type_1.BUILD_SCRIPT_MAKERS[projectType](".");
            for (let i = 0; i < buildCommands.length; i++) {
                const x = buildCommands[i];
                yield (0, utils_1.spawnPromise)(x);
            }
        }
        catch (e) {
            throw e;
        }
    });
}
function build() {
    (0, utils_1.addToExecuteQueue)(() => do_build());
    return (0, utils_1.finish)();
}
