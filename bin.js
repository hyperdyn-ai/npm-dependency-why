#!/usr/bin/env node
const { execSync } = require('child_process');
const https = require('https');

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const targetPackage = args.find(arg => !arg.startsWith('--'));

if (!targetPackage) {
  console.error("Usage: npx npm-dependency-why <package-name>");
  process.exit(1);
}

function fetchPackageInfo(pkg) {
  return new Promise((resolve) => {
    https.get(`https://registry.npmjs.org/${pkg}/latest`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
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
    let lsOutput;
    try {
      lsOutput = execSync(`npm ls ${targetPackage} --json`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    } catch(e) {
      lsOutput = e.stdout ? e.stdout.toString() : "{}";
    }

    const lsData = JSON.parse(lsOutput || "{}");
    
    let bestChain = [];
    let version = "";
    
    function findChain(node, target, currentChain) {
      if (!node) return;
      if (node.name === target) {
        bestChain = [...currentChain, target];
        if (node.version) version = node.version;
        return true;
      }
      if (node.dependencies) {
        for (const [depName, depInfo] of Object.entries(node.dependencies)) {
          depInfo.name = depName;
          if (findChain(depInfo, target, [...currentChain, node.name || 'your-app'])) {
            return true;
          }
        }
      }
      return false;
    }

    findChain(lsData, targetPackage, []);

    let chainDisplay = "";
    if (bestChain.length > 0) {
      const reversed = [...bestChain].reverse();
      chainDisplay += reversed[0] + "\n";
      for (let i = 1; i < reversed.length; i++) {
        chainDisplay += "   ".repeat(i - 1) + "└─ required by " + reversed[i] + "\n";
      }
    } else {
      chainDisplay = `${targetPackage}\n└─ (Not found in current project)`;
    }

    const pkgInfo = await fetchPackageInfo(targetPackage);
    let sizeInfo = "Unknown";
    let downloadSize = "Unknown";
    let gitRepository = "N/A";
    let homepage = "N/A";
    let maintainers = "N/A";
    let reasonInfo = "It is required for the application to function or as a sub-dependency.";

    if (pkgInfo) {
      if (pkgInfo.dist && pkgInfo.dist.unpackedSize) {
        sizeInfo = formatBytes(pkgInfo.dist.unpackedSize);
      }
      if (pkgInfo.dist && pkgInfo.dist.tarball) {
        const tarballSize = pkgInfo.dist.tarball.split('/').pop();
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

    if (bestChain.length === 1) {
      reasonInfo = "Direct dependency installed in the project.";
    } else if (bestChain.length > 1) {
      reasonInfo = `Installed because it is a dependency of ${bestChain[bestChain.length - 2]}.`;
    }

    if (isJson) {
      console.log(JSON.stringify({
        name: targetPackage,
        version: version || "unknown",
        chain: chainDisplay.trim(),
        size: sizeInfo,
        installSize: downloadSize,
        repository: gitRepository,
        homepage: homepage,
        maintainers: maintainers,
        reason: reasonInfo,
        depthInTree: bestChain.length
      }));
    } else {
      console.log(`\n[PACKAGE] ${targetPackage}`);
      if (version) console.log(`[VERSION] ${version}`);
      console.log(`\n[DEPENDENCY TREE]`);
      console.log(chainDisplay.trim());
      console.log(`\n[DETAILS]`);
      console.log(`  Size Impact: ${sizeInfo}`);
      console.log(`  Install Size: ${downloadSize}`);
      console.log(`  Depth in Tree: Level ${bestChain.length}`);
      console.log(`  Reason: ${reasonInfo}`);
      if (gitRepository !== "N/A") console.log(`  Repository: ${gitRepository}`);
      if (homepage !== "N/A") console.log(`  Homepage: ${homepage}`);
      if (maintainers !== "N/A") console.log(`  Maintainers: ${maintainers}`);
      console.log("");
    }

  } catch(error) {
    if (isJson) {
      console.log(JSON.stringify({
        name: targetPackage,
        version: "unknown",
        chain: `${targetPackage}\n└─ Error generating chain`,
        size: "Unknown",
        installSize: "Unknown",
        repository: "N/A",
        homepage: "N/A",
        maintainers: "N/A",
        reason: error.message,
        depthInTree: 0
      }));
    } else {
      console.error("[ERROR] Failed to analyze dependency:", error.message);
    }
  }
}

run();
