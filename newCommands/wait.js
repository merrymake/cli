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
exports.wait = wait;
const prompt_1 = require("../prompt");
function wait(text, action) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return (0, prompt_1.choice)(text, [{ long: "continue", text: "continue", action }], {
                disableAutoPick: true,
            });
        }
        catch (e) {
            throw e;
        }
    });
}
