import * as path from 'path';

/**
 * Recognises the two shapes of MDITA map that the server accepts: a
 * `.mditamap` file, and a Markdown file whose front matter declares the DITA
 * map schema.
 */

export function isMapExtension(fsPath: string): boolean {
    return path.extname(fsPath).toLowerCase() === '.mditamap';
}

const frontMatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;
const schemaPattern = /^\s*\$schema\s*:\s*(.+?)\s*$/m;

/** Value of the `$schema` key in the document's front matter, when present. */
export function frontMatterSchema(text: string): string | null {
    const frontMatter = frontMatterPattern.exec(text);
    if (!frontMatter) {
        return null;
    }

    const schema = schemaPattern.exec(frontMatter[1]);
    if (!schema) {
        return null;
    }

    return schema[1].replace(/^["']|["']$/g, '').trim();
}

/**
 * True when the front matter names one of the DITA map schemas. The server
 * accepts either the XSD or the RNG spelling.
 */
export function declaresMapSchema(text: string): boolean {
    const schema = frontMatterSchema(text);
    if (!schema) {
        return false;
    }
    return /(^|:)map\.(xsd|rng)$/.test(schema);
}

export function isMapDocument(fsPath: string, text: string): boolean {
    return isMapExtension(fsPath) || declaresMapSchema(text);
}
