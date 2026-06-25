#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const localSourceDir = process.env.WAVEDASH_SKILLS_SOURCE_DIR;
const remoteBaseUrl = (
  process.env.WAVEDASH_SKILLS_BASE_URL ||
  "https://docs.wavedash.com/.well-known/skills"
).replace(/\/+$/, "");
const skillOutputDirs = [
  path.join(repoRoot, "skills"),
  path.join(repoRoot, "providers/claude/plugin/skills"),
  path.join(repoRoot, "providers/cursor/plugin/skills"),
  path.join(repoRoot, "providers/openai/plugin/skills"),
];
const versionFiles = [
  path.join(repoRoot, ".claude-plugin/marketplace.json"),
  path.join(repoRoot, "providers/claude/plugin/.claude-plugin/plugin.json"),
  path.join(repoRoot, ".cursor-plugin/marketplace.json"),
  path.join(repoRoot, "providers/cursor/plugin/.cursor-plugin/plugin.json"),
  path.join(repoRoot, "providers/openai/plugin/.codex-plugin/plugin.json"),
  path.join(repoRoot, "gemini-extension.json"),
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isSafeSkillName(name) {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

function isSafeRelativeFile(file) {
  return (
    typeof file === "string" &&
    file.length > 0 &&
    !file.includes("\0") &&
    !path.isAbsolute(file) &&
    file.split("/").every((segment) => {
      return segment.length > 0 && segment !== "." && segment !== "..";
    })
  );
}

function listFilesRecursive(dir, baseDir = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursive(fullPath, baseDir);
      }

      if (!entry.isFile()) {
        return [];
      }

      return [path.relative(baseDir, fullPath).split(path.sep).join("/")];
    })
    .sort((a, b) => {
      if (a === "SKILL.md") return -1;
      if (b === "SKILL.md") return 1;
      return a.localeCompare(b);
    });
}

function getLocalManifest(sourceDir) {
  const skills = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(isSafeSkillName)
    .sort()
    .map((name) => ({
      name,
      files: listFilesRecursive(path.join(sourceDir, name)),
    }));

  return { version: 1, skills };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function getManifest() {
  if (localSourceDir) {
    const resolved = path.resolve(localSourceDir);
    if (!fs.existsSync(resolved)) {
      fail(`WAVEDASH_SKILLS_SOURCE_DIR does not exist: ${resolved}`);
    }
    return getLocalManifest(resolved);
  }

  return fetchJson(`${remoteBaseUrl}/index.json`);
}

function validateManifest(manifest) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.skills)) {
    fail("Invalid skill manifest.");
  }

  for (const skill of manifest.skills) {
    if (!skill || !isSafeSkillName(skill.name) || !Array.isArray(skill.files)) {
      fail("Invalid skill entry in manifest.");
    }

    if (!skill.files.includes("SKILL.md")) {
      fail(`Skill ${skill.name} is missing SKILL.md.`);
    }

    for (const file of skill.files) {
      if (!isSafeRelativeFile(file)) {
        fail(`Invalid file path in skill ${skill.name}: ${file}`);
      }
    }
  }
}

async function readSkillFile(skillName, file) {
  if (localSourceDir) {
    return fs.readFileSync(path.join(localSourceDir, skillName, file), "utf8");
  }

  const encodedFile = file.split("/").map(encodeURIComponent).join("/");
  return fetchText(`${remoteBaseUrl}/${skillName}/${encodedFile}`);
}

function hasGitHead() {
  try {
    execSync("git rev-parse --verify HEAD", {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function gitSkillStatus() {
  if (!hasGitHead()) {
    return "";
  }

  return execSync("git status --porcelain -- skills", {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function updateVersionValue(value, type) {
  if (typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value)) {
    return bumpVersion(value, type);
  }
  return value;
}

function bumpVersions(type) {
  for (const file of versionFiles) {
    const raw = fs.readFileSync(file, "utf8");
    const json = JSON.parse(raw);

    json.version = updateVersionValue(json.version, type);

    if (Array.isArray(json.plugins)) {
      for (const plugin of json.plugins) {
        plugin.version = updateVersionValue(plugin.version, type);
      }
    }

    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  }
}

function getSkillChangeType(status) {
  const lines = status.trim().split("\n").filter(Boolean);
  const addedOrDeleted = lines.some((line) => {
    return line.startsWith("??") || line[0] === "D" || line[1] === "D";
  });

  if (addedOrDeleted) {
    return "minor";
  }

  if (lines.length > 0) {
    return "patch";
  }

  return null;
}

async function main() {
  const manifest = await getManifest();
  validateManifest(manifest);

  for (const dir of skillOutputDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  for (const skill of manifest.skills) {
    for (const file of skill.files) {
      const body = await readSkillFile(skill.name, file);

      for (const dir of skillOutputDirs) {
        const destination = path.join(dir, skill.name, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, body);
      }
    }
  }

  const changeType = getSkillChangeType(await gitSkillStatus());
  if (changeType) {
    bumpVersions(changeType);
  }

  console.log(
    `Synced ${manifest.skills.length} skill(s) to ${skillOutputDirs.length} output directories.`,
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
