import fs from "fs-extra";
import { resolvePath } from "../utils/pathHelper.js";
import { exec } from "child_process";
import util from "util";
import path from "path";

const execPromise = util.promisify(exec);

// Helper for config management
function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
        if (!acc[part]) acc[part] = {};
        return acc[part];
    }, obj);
    target[last] = value;
}

export const read_logs = async (args) => {
    const linesToRead = args?.lines || 50;
    const logDir = resolvePath("logs");
    
    if (!await fs.pathExists(logDir)) {
        return { content: [{ type: "text", text: "No logs directory found." }] };
    }

    // Find latest log file
    const files = await fs.readdir(logDir);
    // Filter for .log.txt files
    const logFiles = files.filter(f => f.endsWith('.log.txt')).sort().reverse();
    
    if (logFiles.length === 0) {
        return { content: [{ type: "text", text: "No log files found." }] };
    }

    const latestLog = path.join(logDir, logFiles[0]);
    const content = await fs.readFile(latestLog, "utf-8");
    const lines = content.trim().split('\n');
    const lastLines = lines.slice(-linesToRead).join('\n');

    return {
        content: [{
            type: "text",
            text: `Reading from ${logFiles[0]}:\n\n${lastLines}`
        }]
    };
};

export const manage_config = async (args) => {
    const { action, key, value } = args;
    const configPath = resolvePath("config/env.json");
    const lockPath = resolvePath("config/env.json.lock");

    if (!await fs.pathExists(configPath)) {
        // Fallback if config doesn't exist
         return { isError: true, content: [{ type: "text", text: "Config file not found." }] };
    }
    
    // Check lock
    if (await fs.pathExists(lockPath)) {
         return { isError: true, content: [{ type: "text", text: "Config is locked by another process." }] };
    }

    try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        let config = JSON.parse(configContent);

        if (action === 'get') {
            if (key) {
                const val = getNestedValue(config, key);
                return { content: [{ type: "text", text: JSON.stringify(val, null, 2) }] };
            } else {
                return { content: [{ type: "text", text: JSON.stringify(config, null, 2) }] };
            }
        } else if (action === 'set') {
             if (!key || value === undefined) {
                 return { isError: true, content: [{ type: "text", text: "Key and value required for set action." }] };
             }
             
             // Create lock
             await fs.outputFile(lockPath, process.pid.toString());
             
             try {
                 let parsedValue = value;
                 try {
                     parsedValue = JSON.parse(value);
                 } catch (e) {
                     // Keep as string
                 }
                 
                 setNestedValue(config, key, parsedValue);
                 await fs.outputFile(configPath, JSON.stringify(config, null, 2));
                 return { content: [{ type: "text", text: `Successfully set ${key} to ${JSON.stringify(parsedValue)}` }] };
             } finally {
                 // Remove lock
                 await fs.remove(lockPath);
             }
        }
    } catch (e) {
         return { isError: true, content: [{ type: "text", text: `Config Error: ${e.message}` }] };
    }
};

export const restart_service = async () => {
    try {
        await execPromise("pm2 restart drpys");
        return { content: [{ type: "text", text: "Service restart command issued." }] };
    } catch (e) {
        return { isError: true, content: [{ type: "text", text: `Failed to restart service: ${e.message}` }] };
    }
};
