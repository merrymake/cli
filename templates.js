"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templates = exports.languages = void 0;
exports.languages = {
    python: { long: "python", short: "p", projectType: "python" },
    csharp: { long: "c#", short: "#", projectType: "csharp" },
    java: { long: "java", short: "j", projectType: "gradle" },
    typescript: { long: "typescript", short: "t", projectType: "typescript" },
    rust: { long: "rust", short: "r", projectType: "rust" },
    go: { long: "go", short: "g", projectType: "go" },
    javascript: { long: "javascript", short: "¤", projectType: "nodejs" },
};
exports.templates = {
    basic: {
        long: "basic",
        short: "b",
        text: "initialize with a basic template",
        languages: [
            "python",
            // "csharp",
            // "java",
            "typescript",
            "rust",
            // "go",
            // "javascript",
        ],
    },
    // web: {
    //   long: "web",
    //   short: "w",
    //   text: "initialize with a webapp/website template",
    //   languages: ["typescript"],
    // },
    // service: {
    //   long: "service",
    //   short: "s",
    //   text: "initialize with a backend service template",
    //   languages: ["typescript"],
    // },
};
