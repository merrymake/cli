"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIT_HOST = exports.SSH_USER = exports.SSH_HOST = exports.HTTP_HOST = exports.API_URL = void 0;
exports.API_URL = `api.merrymake.io`;
exports.HTTP_HOST = `https://${exports.API_URL}`;
exports.SSH_HOST = `${exports.API_URL}`;
exports.SSH_USER = `mist`;
exports.GIT_HOST = `ssh://mist@${exports.API_URL}`;
