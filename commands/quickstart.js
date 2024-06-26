"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickstart = void 0;
const utils_1 = require("../utils");
const apikey_1 = require("../newCommands/apikey");
const group_1 = require("./group");
const org_1 = require("./org");
const register_1 = require("../newCommands/register");
const repo_1 = require("../newCommands/repo");
function quickstart() {
    let cache = (0, utils_1.getCache)();
    if (!cache.registered)
        (0, utils_1.addToExecuteQueue)(() => (0, register_1.do_register)(register_1.generateNewKey, ""));
    let orgName = (0, org_1.generateOrgName)();
    let pth = new utils_1.Path();
    (0, utils_1.addToExecuteQueue)(() => (0, org_1.createOrganization)(orgName));
    let pathToOrg = pth.with(orgName);
    (0, utils_1.addToExecuteQueue)(() => (0, apikey_1.do_key)(orgName, null, "from quickcreate", "14days"));
    (0, utils_1.addToExecuteQueue)(() => (0, group_1.createServiceGroup)(pathToOrg, "service-group-1"));
    let pathToGroup = pathToOrg.with("service-group-1");
    (0, utils_1.addToExecuteQueue)(() => (0, repo_1.do_createService)(pathToGroup, "service-group-1", "service-1"));
    let pathToService = pathToGroup.with("service-1");
    return (0, repo_1.service_template)(pathToService, "basic");
}
exports.quickstart = quickstart;
