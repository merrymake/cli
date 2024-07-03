"use strict";
// import { Path, addToExecuteQueue, getCache } from "../utils";
// import { do_key } from "../newCommands/apikey";
// import { createServiceGroup } from "./group";
// import { createOrganization, generateOrgName } from "./org";
// import { do_register, generateNewKey } from "../newCommands/register";
// import { do_createService, service_template } from "../newCommands/repo";
//
// export function quickstart() {
//   const cache = getCache();
//   if (!cache.registered)
//     addToExecuteQueue(() => do_register(generateNewKey, ""));
//   const orgName = generateOrgName();
//   const pth = new Path();
//   addToExecuteQueue(() => createOrganization(orgName));
//   const pathToOrg = pth.with(orgName);
//   addToExecuteQueue(() => do_key(orgName, null, "from quickcreate", "14days"));
//   addToExecuteQueue(() => createServiceGroup(pathToOrg, "service-group-1"));
//   const pathToGroup = pathToOrg.with("service-group-1");
//   addToExecuteQueue(() =>
//     do_createService(pathToGroup, "service-group-1", "service-1")
//   );
//   const pathToService = pathToGroup.with("service-1");
//   return service_template(pathToService, "basic");
// }
//
