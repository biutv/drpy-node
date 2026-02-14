import fs from "fs-extra";
import { resolvePath, isSafePath } from "../utils/pathHelper.js";
import { decodeDsSource } from "../utils/dsHelper.js";

export const list_directory = async (args) => {
    const dirPath = args?.path || ".";
    if (!isSafePath(dirPath)) {
        throw new Error("Access denied");
    }
    const fullPath = resolvePath(dirPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    files.map((f) => ({
                        name: f.name,
                        isDirectory: f.isDirectory(),
                    })),
                    null,
                    2
                ),
            },
        ],
    };
};

export const read_file = async (args) => {
    const filePath = args?.path;
    if (!filePath || !isSafePath(filePath)) {
        throw new Error("Invalid path");
    }
    let content = await fs.readFile(resolvePath(filePath), "utf-8");
    
    // Attempt to decode if it's a JS file (for DS sources)
    if (filePath.endsWith('.js')) {
         content = await decodeDsSource(content);
    }

    return {
        content: [
            {
                type: "text",
                text: content,
            },
        ],
    };
};

export const write_file = async (args) => {
    const filePath = args?.path;
    const content = args?.content;
    if (!filePath || !isSafePath(filePath)) {
        throw new Error("Invalid path");
    }
    await fs.outputFile(resolvePath(filePath), content);
    return {
        content: [
            {
                type: "text",
                text: `Successfully wrote to ${filePath}`,
            },
        ],
    };
};

export const delete_file = async (args) => {
    const filePath = args?.path;
    if (!filePath || !isSafePath(filePath)) {
        throw new Error("Invalid path");
    }
    await fs.remove(resolvePath(filePath));
    return {
        content: [
            {
                type: "text",
                text: `Successfully deleted ${filePath}`,
            },
        ],
    };
};
