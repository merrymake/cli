export const FINGERPRINT = `AAAAC3NzaC1lZDI1NTE5AAAAIPLSjAn8YwNclgEEk8fgyNb1pbhn9X7bMKwFUweaoPzn`;
export const MERRYMAKE_IO = process.env["ASDF_DOMAIN"] || `merrymake.io`;
export const API_URL = `api.${MERRYMAKE_IO}`;
export const RAPIDS_HOST = `https://rapids.${MERRYMAKE_IO}`;

export const HTTP_HOST = `https://${API_URL}`;
export const SSH_HOST = `${API_URL}`;
export const SSH_USER = `mist`;
export const GIT_HOST = `ssh://${SSH_USER}@${API_URL}`;

export const SPECIAL_FOLDERS = ["event-catalogue", "public"];
