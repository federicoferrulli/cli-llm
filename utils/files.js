import fs from "fs";
import path from "path";

export function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
}

export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, "utf8");
}

export function readJsonFile(filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`File non trovato: ${resolved}`);
    }
    const content = fs.readFileSync(resolved, "utf8");
    return JSON.parse(content);
}
