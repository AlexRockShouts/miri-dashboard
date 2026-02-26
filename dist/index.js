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
const sdk_1 = require("@miri/sdk");
function generateDashboard() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const api = new sdk_1.Api();
        console.log('--- Miri Dashboard ---');
        try {
            // 1. Health Check
            const health = yield api.api.adminV1HealthList();
            console.log(`Status: ${health.data.status || 'Unknown'}`);
            console.log(`Message: ${health.data.message || 'N/A'}`);
            console.log('----------------------');
            // 2. Configuration
            const config = yield api.api.adminV1ConfigList();
            console.log('Configuration:');
            console.log(`  Server Addr: ${((_a = config.data.server) === null || _a === void 0 ? void 0 : _a.addr) || 'N/A'}`);
            console.log(`  Storage Dir: ${config.data.storage_dir || 'N/A'}`);
            console.log(`  Models Mode: ${((_b = config.data.models) === null || _b === void 0 ? void 0 : _b.mode) || 'N/A'}`);
            console.log('----------------------');
            // 3. Active Sessions
            const sessions = yield api.api.adminV1SessionsList();
            console.log(`Active Sessions: ${sessions.data.length}`);
            for (const sessionId of sessions.data) {
                console.log(`  - ${sessionId}`);
            }
            console.log('----------------------');
            // 4. Human Info
            const humans = yield api.api.adminV1HumanList();
            console.log(`Stored Humans: ${humans.data.length}`);
            for (const human of humans.data) {
                console.log(`  - ${human.id || 'Unknown ID'}: ${human.notes || 'No notes'}`);
            }
            console.log('----------------------');
        }
        catch (error) {
            if (error.response) {
                console.error(`Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            else {
                console.error(`Error: ${error.message}`);
            }
            console.log('\nMake sure the Miri server is running at http://localhost:8080');
        }
    });
}
generateDashboard();
