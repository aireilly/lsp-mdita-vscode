import * as assert from 'assert';

import { declaresMapSchema, frontMatterSchema, isMapDocument, isMapExtension } from '../../mapfile';

function frontMatter(schema: string): string {
    return `---\n$schema: ${schema}\nid: product-map\n---\n\n# Product Documentation\n`;
}

describe('isMapExtension', () => {
    it('accepts .mditamap', () => {
        assert.ok(isMapExtension('/docs/product.mditamap'));
    });

    it('is case insensitive', () => {
        assert.ok(isMapExtension('/docs/PRODUCT.MDITAMAP'));
    });

    it('rejects markdown', () => {
        assert.ok(!isMapExtension('/docs/install.md'));
    });

    it('rejects a name that merely contains the extension', () => {
        assert.ok(!isMapExtension('/docs/product.mditamap.bak'));
    });
});

describe('frontMatterSchema', () => {
    it('reads an unquoted value', () => {
        assert.strictEqual(
            frontMatterSchema(frontMatter('urn:oasis:names:tc:dita:xsd:map.xsd')),
            'urn:oasis:names:tc:dita:xsd:map.xsd'
        );
    });

    it('strips quotes', () => {
        assert.strictEqual(
            frontMatterSchema(frontMatter('"urn:oasis:names:tc:dita:rng:map.rng"')),
            'urn:oasis:names:tc:dita:rng:map.rng'
        );
    });

    it('tolerates CRLF line endings', () => {
        const text = '---\r\n$schema: urn:oasis:names:tc:dita:xsd:map.xsd\r\n---\r\n\r\n# Map\r\n';
        assert.strictEqual(frontMatterSchema(text), 'urn:oasis:names:tc:dita:xsd:map.xsd');
    });

    it('returns null without front matter', () => {
        assert.strictEqual(frontMatterSchema('# Just a heading\n'), null);
    });

    it('returns null when front matter declares no schema', () => {
        assert.strictEqual(frontMatterSchema('---\nid: topic-id\n---\n\n# Topic\n'), null);
    });

    it('ignores a $schema line in the body', () => {
        assert.strictEqual(frontMatterSchema('# Topic\n\n$schema: urn:oasis:names:tc:dita:xsd:map.xsd\n'), null);
    });
});

describe('declaresMapSchema', () => {
    it('accepts the XSD map schema', () => {
        assert.ok(declaresMapSchema(frontMatter('urn:oasis:names:tc:dita:xsd:map.xsd')));
    });

    it('accepts the RNG map schema', () => {
        assert.ok(declaresMapSchema(frontMatter('urn:oasis:names:tc:dita:rng:map.rng')));
    });

    it('rejects a topic schema', () => {
        assert.ok(!declaresMapSchema(frontMatter('urn:oasis:names:tc:mdita:rng:topic.rng')));
    });

    it('rejects a concept schema', () => {
        assert.ok(!declaresMapSchema(frontMatter('urn:oasis:names:tc:dita:xsd:concept.xsd')));
    });

    it('rejects a schema whose last segment merely ends in map', () => {
        assert.ok(!declaresMapSchema(frontMatter('urn:oasis:names:tc:dita:xsd:sitemap.xsd')));
    });
});

describe('isMapDocument', () => {
    it('accepts a .mditamap regardless of front matter', () => {
        assert.ok(isMapDocument('/docs/product.mditamap', '# Product Documentation\n'));
    });

    it('accepts markdown declaring the map schema', () => {
        assert.ok(isMapDocument('/docs/product.md', frontMatter('urn:oasis:names:tc:dita:xsd:map.xsd')));
    });

    it('rejects an ordinary topic', () => {
        assert.ok(!isMapDocument('/docs/install.md', frontMatter('urn:oasis:names:tc:mdita:rng:topic.rng')));
    });

    it('rejects a bare markdown file', () => {
        assert.ok(!isMapDocument('/docs/notes.md', '# Notes\n'));
    });
});
