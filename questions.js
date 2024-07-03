"use strict";
// import fs from "fs";
// import { key } from "./newCommands/apikey";
// import { checkout } from "./commands/clone";
// import { deploy, redeploy } from "./newCommands/deploy";
// import { envvar } from "./newCommands/envvar";
// import { event } from "./newCommands/event";
// import { fetch } from "./newCommands/fetch";
// import { group } from "./commands/group";
// import { BITBUCKET_FILE, hosting } from "./commands/hosting";
// import { org } from "./commands/org";
// import { queue } from "./commands/queue";
// import { quickstart } from "./commands/quickstart";
// import { register } from "./newCommands/register";
// import { repo } from "./newCommands/repo";
// import { role } from "./newCommands/role";
// import {
//   SPECIAL_FOLDERS,
//   do_delete_group,
//   do_delete_org,
//   do_help,
//   do_join,
//   do_spending,
// } from "./executors";
// import { Option, choice, shortText } from "./prompt";
// import {
//   Path,
//   abort,
//   addExitMessage,
//   addToExecuteQueue,
//   directoryNames,
//   fetchOrgRaw,
//   finish,
//   getCache,
//   sshReq,
// } from "./utils";
//
// function help() {
//   addToExecuteQueue(() => do_help());
//   return finish();
// }
//
// function spending(org: string) {
//   addToExecuteQueue(() => do_spending(org));
//   return finish();
// }
//
// function delete_group_name(org: string, group: string) {
//   addToExecuteQueue(() => do_delete_group(org, group));
//   return finish();
// }
//
// function delete_org_name(org: string) {
//   addToExecuteQueue(() => do_delete_org(org));
//   return finish();
// }
//
// async function extra(orgName: string, pathToRoot: string) {
//   try {
//     const options: Option[] = [];
//     options.push({
//       long: "role",
//       short: "o",
//       text: "add or assign roles to users in the organization",
//       action: () => role(orgName),
//     });
//     options.push({
//       long: "usage",
//       short: "u",
//       text: "view usage breakdown for the last two months",
//       action: () => spending(orgName),
//     });
//     options.push({
//       long: "register",
//       short: "e",
//       text: "register an additional sshkey or email to account",
//       action: () => register(),
//     });
//     if (!fs.existsSync(pathToRoot + BITBUCKET_FILE)) {
//       options.push({
//         long: "hosting",
//         text: "configure git hosting with bitbucket", // TODO add github, gitlab, and azure devops
//         action: () => hosting(pathToRoot, orgName),
//       });
//     }
//     options.push({
//       long: "help",
//       short: "h",
//       text: "help diagnose potential issues",
//       action: () => help(),
//     });
//     return await choice("What would you like to do?", options).then();
//   } catch (e) {
//     throw e;
//   }
// }
//
// async function delete_group(org: string) {
//   try {
//     const resp = await sshReq(`list-teams`, `--org`, org);
//     const orgs: string[] = JSON.parse(resp);
//     return await choice(
//       "Which service GROUP do you want to delete?",
//       orgs.map((x) => ({
//         long: x,
//         text: `delete ${x}`,
//         action: () => delete_group_name(org, x),
//       })),
//       { disableAutoPick: true }
//     ).then();
//   } catch (e) {
//     throw e;
//   }
// }
//
// async function delete_org() {
//   try {
//     const resp = await sshReq(`list-organizations`);
//     const orgs: string[] = JSON.parse(resp);
//     return await choice(
//       "Which ORGANIZATION do you want to delete?",
//       orgs.map((x) => ({
//         long: x,
//         text: `delete ${x}`,
//         action: () => delete_org_name(x),
//       })),
//       { disableAutoPick: true }
//     ).then();
//   } catch (e) {
//     throw e;
//   }
// }
//
// function please_register_first() {
//   addExitMessage(`Please run '${process.env["COMMAND"]} register' first.`);
//   return abort();
// }
//
// export async function start() {
//   try {
//     const rawStruct = fetchOrgRaw();
//     if (rawStruct.org !== null) {
//       const orgName = rawStruct.org.name;
//       // If in org
//       const options: Option[] = [];
//       const selectedGroup: { name: string; path: Path } | null = null;
//       const struct = {
//         org: rawStruct.org,
//         serviceGroup:
//           rawStruct.serviceGroup !== null &&
//           !SPECIAL_FOLDERS.includes(rawStruct.serviceGroup)
//             ? rawStruct.serviceGroup
//             : null,
//         inEventCatalogue: rawStruct.serviceGroup === "event-catalogue",
//         inPublic: rawStruct.serviceGroup === "public",
//         pathToRoot: rawStruct.pathToRoot,
//       };
//       if (struct.serviceGroup !== null) {
//         selectedGroup = {
//           name: struct.serviceGroup,
//           path: new Path(struct.pathToRoot).withoutLastUp(),
//         };
//       } else {
//         const serviceGroups = directoryNames(new Path(), [
//           "event-catalogue",
//           "public",
//         ]);
//         if (serviceGroups.length === 1) {
//           selectedGroup = {
//             name: serviceGroups[0].name,
//             path: new Path(serviceGroups[0].name),
//           };
//         }
//       }
//
//       options.push({
//         long: "rapids",
//         short: "q",
//         text: "view or post messages to the rapids",
//         action: () => queue(orgName, 0),
//       });
//       if (
//         fs.existsSync("merrymake.json") ||
//         struct.inEventCatalogue ||
//         struct.inPublic
//       ) {
//         // Inside a service
//         options.push({
//           long: "deploy",
//           short: "d",
//           text: "deploy service to the cloud",
//           action: () => deploy(),
//         });
//         options.push({
//           long: "redeploy",
//           short: "r",
//           text: "redeploy service to the cloud",
//           action: () => redeploy(),
//         });
//       } else {
//         // Not inside a service
//         options.push({
//           long: "fetch",
//           short: "f",
//           text: "fetch updates to service groups and repos",
//           action: () => fetch(),
//         });
//         if (selectedGroup !== null) {
//           // Inside a service group or has one service
//           const selectedGroup_hack = selectedGroup;
//           options.push({
//             long: "repo",
//             short: "r",
//             text: "add or edit repository",
//             action: () =>
//               repo(selectedGroup_hack.path, orgName, selectedGroup_hack.name),
//           });
//         }
//       }
//       // if (fs.existsSync("merrymake.json")) {
//       //   options.push({
//       //     long: "build",
//       //     short: "b",
//       //     text: "build service locally",
//       //     action: () => build(),
//       //   });
//       // }
//
//       if (selectedGroup !== null) {
//         // Inside a service group or service
//         const selectedGroup_hack = selectedGroup;
//         options.push({
//           long: "envvar",
//           short: "e",
//           text: "add or edit envvar for service group",
//           action: () => envvar(orgName, selectedGroup_hack.name),
//         });
//       }
//
//       if (struct.serviceGroup === null) {
//         // In top level of organization
//         options.push({
//           long: "group",
//           short: "g",
//           text: "create a service group",
//           action: () => group(new Path(), orgName),
//         });
//         options.push({
//           long: "delete",
//           short: "d",
//           text: "delete a service group",
//           action: () => delete_group(orgName),
//         });
//       }
//
//       // options.push({
//       //   long: "cron",
//       //   short: "c",
//       //   text: "add or edit cron jobs for the organization",
//       //   action: () => cron(orgName),
//       // });
//       options.push({
//         long: "key",
//         short: "k",
//         text: "add or edit api-keys for the organization",
//         action: () => key(orgName),
//       });
//       options.push({
//         long: "event",
//         short: "v",
//         text: "allow or disallow events through api-keys for the organization",
//         action: () => event(orgName),
//       });
//       options.push({
//         long: "other",
//         short: "o",
//         text: "other actions",
//         action: () => extra(orgName, struct.pathToRoot),
//       });
//
//       return await choice("What would you like to do?", options).then();
//     } else {
//       const cache = getCache();
//       const options: (Option & { weight: number })[] = [];
//       options.push({
//         long: "register",
//         short: "r",
//         text: "register new device or email",
//         action: () => register(),
//         weight: !cache.registered ? 10 : 1,
//       });
//       options.push({
//         long: "quickstart",
//         text: "quickstart with auto registration and a standard demo organization",
//         action: () => quickstart(),
//         weight: !cache.registered ? 15 : 2,
//       });
//       options.push({
//         long: "org",
//         short: "o",
//         text: "create a new organization",
//         action: () => (cache.registered ? org() : please_register_first()),
//         weight: 5,
//       });
//       options.push({
//         long: "clone",
//         short: "c",
//         text: "clone an existing organization",
//         action: () => (cache.registered ? checkout() : please_register_first()),
//         weight: cache.hasOrgs ? 10 : 3,
//       });
//       options.push({
//         long: "delete",
//         short: "d",
//         text: "delete an organization",
//         action: () =>
//           cache.registered ? delete_org() : please_register_first(),
//         weight: cache.hasOrgs ? 10 : 3,
//       });
//       options.push({
//         long: "join",
//         short: "j",
//         text: "request to join an existing organization",
//         action: () => (cache.registered ? join() : please_register_first()),
//         weight: 4,
//       });
//       options.push({
//         long: "help",
//         text: "help diagnose potential issues",
//         action: () => help(),
//         weight: 0,
//       });
//       options.sort((a, b) => b.weight - a.weight);
//       return await choice("What would you like to do?", options).then();
//     }
//   } catch (e) {
//     throw e;
//   }
// }
//
