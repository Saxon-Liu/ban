const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");
const releaseRoot = path.join(projectRoot, "release");
const target = path.join(releaseRoot, String(pkg.version));

function assertSafeTarget(targetPath) {
  const resolvedReleaseRoot = path.resolve(releaseRoot);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedReleaseRoot, resolvedTarget);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean path outside release root: ${resolvedTarget}`);
  }
}

function makeWritable(targetPath) {
  if (!fs.existsSync(targetPath)) return;

  const stat = fs.lstatSync(targetPath);
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      makeWritable(path.join(targetPath, entry.name));
    }
    fs.chmodSync(targetPath, 0o777);
    return;
  }

  fs.chmodSync(targetPath, 0o666);
}

function removeTarget(targetPath, retries = 8) {
  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
    maxRetries: retries,
    retryDelay: 500,
  });
}

function explainFailure(error) {
  console.error(`Failed to clean ${target}`);
  console.error(error && error.stack ? error.stack : error);
  console.error("");
  console.error("Common causes on Windows:");
  console.error("1. The previous packaged app is still running.");
  console.error("2. File Explorer, terminal, or editor is opened inside release output.");
  console.error("3. Antivirus or Windows Defender is still scanning the generated exe.");
  console.error("4. The release directory has unusual permissions.");
  console.error("");
  console.error("Close the packaged app and File Explorer windows, wait a few seconds, then retry.");
}

assertSafeTarget(target);

if (!fs.existsSync(target)) {
  console.log("cleaned", target);
  process.exit(0);
}

try {
  removeTarget(target);
  console.log("cleaned", target);
  process.exit(0);
} catch (firstError) {
  try {
    makeWritable(target);
    removeTarget(target, 12);
    console.log("cleaned", target);
    process.exit(0);
  } catch (secondError) {
    const staleTarget = path.join(
      releaseRoot,
      `${pkg.version}.stale-${Date.now()}`
    );

    try {
      assertSafeTarget(staleTarget);
      fs.renameSync(target, staleTarget);
      console.warn(`renamed locked release directory to ${staleTarget}`);

      try {
        removeTarget(staleTarget, 4);
      } catch {
        console.warn(`stale release directory could not be removed yet: ${staleTarget}`);
      }

      console.log("cleaned", target);
      process.exit(0);
    } catch {
      explainFailure(secondError || firstError);
      process.exit(1);
    }
  }
}
