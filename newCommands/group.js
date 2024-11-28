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
exports.do_createServiceGroup = do_createServiceGroup;
exports.group = group;
const fs_1 = __importDefault(require("fs"));
const prompt_1 = require("../prompt");
const types_1 = require("../types");
const utils_1 = require("../utils");
const repo_1 = require("./repo");
function do_createServiceGroup(path, organizationId, displayName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`Creating service group '${displayName}'...`);
            const reply = yield (0, utils_1.sshReq)(`group-create`, displayName, `--organizationId`, organizationId.toString());
            if (reply.length !== 8)
                throw reply;
            fs_1.default.mkdirSync(path.toString(), { recursive: true });
            const serviceGroupId = new types_1.ServiceGroupId(reply);
            fs_1.default.writeFileSync(path.with(".group-id").toString(), serviceGroupId.toString());
            return serviceGroupId;
        }
        catch (e) {
            throw e;
        }
    });
}
function group(organization) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let num = 1;
            while (fs_1.default.existsSync(organization.pathTo.with("service-group-" + num).toString()))
                num++;
            const displayName = yield (0, prompt_1.shortText)("Service group name", "Used to share envvars.", "service-group-" + num).then();
            const folderName = (0, utils_1.toFolderName)(displayName);
            const pathToServiceGroup = organization.pathTo.with(folderName);
            const serviceGroupId = yield do_createServiceGroup(pathToServiceGroup, organization.id, displayName);
            return (0, repo_1.repo_create)(organization, {
                pathTo: pathToServiceGroup,
                id: serviceGroupId,
            });
        }
        catch (e) {
            throw e;
        }
    });
}
