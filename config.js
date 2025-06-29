export const FINGERPRINT = `AAAAC3NzaC1lZDI1NTE5AAAAIPLSjAn8YwNclgEEk8fgyNb1pbhn9X7bMKwFUweaoPzn`;
export const MERRYMAKE_IO = process.env["ASDF_DOMAIN"] || `merrymake.io`;
export const API_URL = `api.${MERRYMAKE_IO}`;
export const RAPIDS_HOST = `https://rapids.${MERRYMAKE_IO}`;
export const HTTP_HOST = `https://${API_URL}`;
export const SSH_HOST = `${API_URL}`;
export const SSH_USER = `mist`;
export const GIT_HOST = `ssh://${SSH_USER}@${API_URL}`;
export const DEFAULT_SERVICE_GROUP_NAME = "back-end";
export const DEFAULT_REPOSITORY_NAME = "service-1";
export const DEFAULT_PUBLIC_NAME = "front-end";
export const DEFAULT_EVENT_CATALOGUE_NAME = "event-configuration";
export const SPECIAL_FOLDERS = [
    DEFAULT_EVENT_CATALOGUE_NAME,
    DEFAULT_PUBLIC_NAME,
];
export const SERVICE_GROUP = "service group";
export const REPOSITORY = "code repository";
export const CLONE = "checkout";
