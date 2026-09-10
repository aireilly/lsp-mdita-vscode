import * as assert from 'assert';

import {
    SearchEnv,
    findServerBinary,
    releaseAssetName,
    releaseDownloadUrl,
    searchDirs,
    serverBinName,
    serverRelease,
    splitCommand,
} from '../../locate';

function makeEnv(present: string[] = [], overrides: Partial<SearchEnv> = {}): SearchEnv {
    return {
        platform: 'linux',
        arch: 'x64',
        pathVar: '/usr/bin:/bin',
        homeDir: '/home/tester',
        isExecutable: (candidate: string) => present.includes(candidate),
        ...overrides,
    };
}

describe('serverBinName', () => {
    it('appends .exe on Windows', () => {
        assert.strictEqual(serverBinName('win32'), 'mdita-lsp.exe');
    });

    it('is bare elsewhere', () => {
        assert.strictEqual(serverBinName('linux'), 'mdita-lsp');
        assert.strictEqual(serverBinName('darwin'), 'mdita-lsp');
    });
});

describe('releaseAssetName', () => {
    const cases: Array<[NodeJS.Platform, string, string]> = [
        ['linux', 'x64', 'mdita-lsp-linux-amd64'],
        ['linux', 'arm64', 'mdita-lsp-linux-arm64'],
        ['darwin', 'x64', 'mdita-lsp-darwin-amd64'],
        ['darwin', 'arm64', 'mdita-lsp-darwin-arm64'],
        ['win32', 'x64', 'mdita-lsp-windows-amd64.exe'],
    ];

    for (const [platform, arch, expected] of cases) {
        it(`maps ${platform}/${arch} to ${expected}`, () => {
            assert.strictEqual(releaseAssetName(platform, arch), expected);
        });
    }

    it('rejects a platform with no published binary', () => {
        assert.throws(() => releaseAssetName('freebsd', 'x64'), /publishes no binary for freebsd\/x64/);
    });

    it('rejects an architecture with no published binary', () => {
        assert.throws(() => releaseAssetName('win32', 'arm64'), /publishes no binary for win32\/arm64/);
    });

    it('rejects 32-bit builds', () => {
        assert.throws(() => releaseAssetName('linux', 'ia32'), /publishes no binary/);
    });
});

describe('releaseDownloadUrl', () => {
    it('points at the pinned release', () => {
        assert.strictEqual(
            releaseDownloadUrl('linux', 'x64'),
            `https://github.com/aireilly/mdita-lsp/releases/download/${serverRelease}/mdita-lsp-linux-amd64`
        );
    });
});

describe('searchDirs', () => {
    it('puts PATH ahead of the install directories', () => {
        const dirs = searchDirs(makeEnv());
        assert.deepStrictEqual(dirs, [
            '/usr/bin',
            '/bin',
            '/home/tester/.local/bin',
            '/home/tester/go/bin',
            '/usr/local/bin',
        ]);
    });

    it('splits PATH on semicolons under Windows', () => {
        const dirs = searchDirs(makeEnv([], {
            platform: 'win32',
            pathVar: 'C:\\bin;C:\\tools',
            homeDir: 'C:\\Users\\tester',
        }));
        assert.strictEqual(dirs[0], 'C:\\bin');
        assert.strictEqual(dirs[1], 'C:\\tools');
    });

    it('drops empty PATH entries', () => {
        const dirs = searchDirs(makeEnv([], { pathVar: '/usr/bin::/bin:' }));
        assert.deepStrictEqual(dirs.slice(0, 2), ['/usr/bin', '/bin']);
        assert.ok(!dirs.includes(''));
    });
});

describe('findServerBinary', () => {
    it('returns null when nothing is installed', () => {
        assert.strictEqual(findServerBinary(makeEnv()), null);
    });

    it('finds a copy on PATH', () => {
        assert.strictEqual(findServerBinary(makeEnv(['/usr/bin/mdita-lsp'])), '/usr/bin/mdita-lsp');
    });

    it('falls back to the make install directory', () => {
        assert.strictEqual(
            findServerBinary(makeEnv(['/home/tester/.local/bin/mdita-lsp'])),
            '/home/tester/.local/bin/mdita-lsp'
        );
    });

    it('falls back to the go install directory', () => {
        assert.strictEqual(
            findServerBinary(makeEnv(['/home/tester/go/bin/mdita-lsp'])),
            '/home/tester/go/bin/mdita-lsp'
        );
    });

    it('prefers PATH over the install directories', () => {
        const found = findServerBinary(makeEnv([
            '/bin/mdita-lsp',
            '/home/tester/.local/bin/mdita-lsp',
        ]));
        assert.strictEqual(found, '/bin/mdita-lsp');
    });

    // Paths stay POSIX-shaped so that path.join behaves the same wherever the
    // suite runs; only the platform under test is swapped.
    it('looks for the .exe name on Windows', () => {
        const found = findServerBinary(makeEnv(['/opt/bin/mdita-lsp.exe'], {
            platform: 'win32',
            pathVar: '/opt/bin',
            homeDir: '/home/tester',
        }));
        assert.strictEqual(found, '/opt/bin/mdita-lsp.exe');
    });

    it('does not accept the bare name on Windows', () => {
        const found = findServerBinary(makeEnv(['/opt/bin/mdita-lsp'], {
            platform: 'win32',
            pathVar: '/opt/bin',
            homeDir: '/home/tester',
        }));
        assert.strictEqual(found, null);
    });
});

describe('splitCommand', () => {
    it('splits a command from its arguments', () => {
        assert.deepStrictEqual(splitCommand('mdita-lsp --stdio'), {
            command: 'mdita-lsp',
            args: ['--stdio'],
        });
    });

    it('handles a bare command', () => {
        assert.deepStrictEqual(splitCommand('  mdita-lsp  '), { command: 'mdita-lsp', args: [] });
    });

    it('collapses repeated whitespace', () => {
        assert.deepStrictEqual(splitCommand('go run ./cmd/mdita-lsp'), {
            command: 'go',
            args: ['run', './cmd/mdita-lsp'],
        });
    });

    it('returns null for an empty value', () => {
        assert.strictEqual(splitCommand('   '), null);
    });
});
