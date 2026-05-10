#!/usr/bin/env node
const { spawnSync } = require('child_process');
const https = require('https');

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const showAllChains = args.includes('--all');
const showHelp = args.includes('--help') || args.includes('-h');
const targetPackage = args.find(arg => !arg.startsWith('--'));

if (showHelp) {
  console.log('Usage: npx npm-dependency-why <package-name> [--json] [--all]');
  console.log('');
  console.log('Options:');
  console.log('  --json   Output machine-readable JSON');
  console.log('  --all    Show all discovered dependency chains');
  console.log('  --help   Show this help message');
  process.exit(0);
}

if (!targetPackage) {
  console.error('Usage: npx npm-dependency-why <package-name> [--json] [--all]');
  process.exit(1);
}

function isValidPackageName(pkg) {
  if (typeof pkg !== 'string' || pkg.length === 0 || pkg.length > 214) return false;
  if (pkg.startsWith('.') || pkg.startsWith('_')) return false;
  if (/\s/.test(pkg)) return false;
  return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(pkg);
}

if (!isValidPackageName(targetPackage)) {
  console.error('[ERROR] Invalid package name.');
  process.exit(1);
}

function runNpmLs(pkg) {
  const result = spawnSync('npm', ['ls', pkg, '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });

  if (result.error) {
    return '{}';
  }

  return (result.stdout || '{}').trim() || '{}';
}

function fetchPackageInfo(pkg) {
  return new Promise((resolve) => {
    const safePkg = encodeURIComponent(pkg);
    const req = https.get(`https://registry.npmjs.org/${safePkg}/latest`, {
      headers: { Accept: 'application/json' }
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.setTimeout(5000, () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

function formatBytes(bytes) {
  if (!bytes) return "Unknown";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

async function run() {
  try {
    const lsOutput = runNpmLs(targetPackage);
    const lsData = JSON.parse(lsOutput || '{}');

    let version = '';
    const chains = [];

    function collectChains(node, nodeName, target, currentChain) {
      if (!node || !node.dependencies) return;

      const baseChain = [...currentChain, nodeName || 'your-app'];
      for (const [depName, depInfo] of Object.entries(node.dependencies)) {
        if (depName === target) {
          chains.push([...baseChain, depName]);
          if (!version && depInfo && depInfo.version) {
            version = depInfo.version;
          }
        }

        collectChains(depInfo, depName, target, baseChain);
      }
    }

    collectChains(lsData, lsData.name || 'your-app', targetPackage, []);
    const bestChain = chains[0] || [];

    function formatChain(chain) {
      if (!chain || chain.length === 0) {
        return `${targetPackage}\n└─ (Not found in current project)`;
      }

      const reversed = [...chain].reverse();
      let display = `${reversed[0]}\n`;
      for (let i = 1; i < reversed.length; i++) {
        display += `${'   '.repeat(i - 1)}└─ required by ${reversed[i]}\n`;
      }
      return display.trim();
    }

    const chainDisplay = formatChain(bestChain);

    const pkgInfo = version ? await fetchPackageInfo(targetPackage) : null;
    let sizeInfo = 'Unknown';
    let downloadSize = 'Unknown';
    let gitRepository = 'N/A';
    let homepage = 'N/A';
    let maintainers = 'N/A';
    let reasonInfo = 'It is required for the application to function or as a sub-dependency.';

    if (pkgInfo) {
      if (pkgInfo.dist && pkgInfo.dist.unpackedSize) {
        sizeInfo = formatBytes(pkgInfo.dist.unpackedSize);
      }
      if (pkgInfo.dist) {
        downloadSize = `${pkgInfo.dist.fileCount || '?'} files`;
      }
      if (pkgInfo.repository) {
        if (typeof pkgInfo.repository === 'string') {
          gitRepository = pkgInfo.repository;
        } else if (pkgInfo.repository.url) {
          gitRepository = pkgInfo.repository.url;
        }
      }
      if (pkgInfo.homepage) {
        homepage = pkgInfo.homepage;
      }
      if (pkgInfo.maintainers && pkgInfo.maintainers.length > 0) {
        maintainers = pkgInfo.maintainers.map(m => m.name || m.email).join(", ");
      }
      if (!version && pkgInfo.version) {
        version = pkgInfo.version;
      }
    }

    if (bestChain.length === 2) {
      reasonInfo = 'Direct dependency installed in the project.';
    } else if (bestChain.length > 2) {
      reasonInfo = `Installed because it is a dependency of ${bestChain[bestChain.length - 2]}.`;
    } else if (bestChain.length === 0) {
      reasonInfo = 'Package is not present in the current project dependency tree.';
    }

    const chainOutput = showAllChains && chains.length > 0
      ? chains.map(formatChain)
      : [chainDisplay];

    const depthInTree = bestChain.length > 0 ? bestChain.length - 1 : 0;

    const jsonPayload = {
      name: targetPackage,
      version: version || 'unknown',
      chain: chainDisplay,
      chains: chainOutput,
      chainCount: chains.length,
      size: sizeInfo,
      installSize: downloadSize,
      repository: gitRepository,
      homepage: homepage,
      maintainers: maintainers,
      reason: reasonInfo,
      depthInTree: depthInTree
    };

    if (!showAllChains) {
      delete jsonPayload.chainCount;
      delete jsonPayload.chains;
    }

    if (isJson) {
      console.log(JSON.stringify(jsonPayload));
    } else {
      console.log(`\n[PACKAGE] ${targetPackage}`);
      if (version) console.log(`[VERSION] ${version}`);
      if (showAllChains && chains.length > 1) {
        console.log('\n[DEPENDENCY TREES]');
        chainOutput.forEach((chainText, index) => {
          console.log(`\n#${index + 1}`);
          console.log(chainText);
        });
      } else {
        console.log('\n[DEPENDENCY TREE]');
        console.log(chainDisplay);
      }
      console.log(`\n[DETAILS]`);
      console.log(`  Size Impact: ${sizeInfo}`);
      console.log(`  Install Size: ${downloadSize}`);
      console.log(`  Depth in Tree: Level ${depthInTree}`);
      if (showAllChains) console.log(`  Matching Chains: ${chains.length}`);
      console.log(`  Reason: ${reasonInfo}`);
      if (gitRepository !== 'N/A') console.log(`  Repository: ${gitRepository}`);
      if (homepage !== 'N/A') console.log(`  Homepage: ${homepage}`);
      if (maintainers !== 'N/A') console.log(`  Maintainers: ${maintainers}`);
      console.log('');
    }

  } catch (error) {
    if (isJson) {
      console.log(JSON.stringify({
        name: targetPackage,
        version: 'unknown',
        chain: `${targetPackage}\n└─ Error generating chain`,
        size: 'Unknown',
        installSize: 'Unknown',
        repository: 'N/A',
        homepage: 'N/A',
        maintainers: 'N/A',
        reason: error.message,
        depthInTree: 0
      }));
    } else {
      console.error("[ERROR] Failed to analyze dependency:", error.message);
    }
  }
}

run();
