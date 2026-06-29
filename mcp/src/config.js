const fieldPattern = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/;
const sectionPattern = /^\[([A-Za-z0-9_-]+)\]$/;

function parseScalar(rawValue) {
  const value = rawValue.trim();
  const quoted = value.match(/^"([\s\S]*)"$/) || value.match(/^'([\s\S]*)'$/);
  if (quoted) return quoted[1];
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export function validateWavedashConfig(tomlText) {
  const text = String(tomlText || "").trim();
  const issues = [];
  const warnings = [];
  const fields = {};
  const sections = new Set();
  let currentSection = "";

  if (!text) {
    return {
      ok: false,
      issues: ["Config text is empty."],
      warnings: [],
      fields: {},
      sections: [],
    };
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const withoutComment = line.replace(/\s+#.*$/, "").trim();
    if (!withoutComment) return;

    const sectionMatch = withoutComment.match(sectionPattern);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections.add(currentSection);
      return;
    }

    const fieldMatch = withoutComment.match(fieldPattern);
    if (!fieldMatch) {
      warnings.push(`Line ${index + 1}: could not parse "${line.trim()}".`);
      return;
    }

    const key = currentSection ? `${currentSection}.${fieldMatch[1]}` : fieldMatch[1];
    fields[key] = parseScalar(fieldMatch[2]);
  });

  if (!fields.game_id || String(fields.game_id).trim() === "") {
    issues.push('Missing required field: game_id = "..."');
  }

  if (!fields.upload_dir || String(fields.upload_dir).trim() === "") {
    issues.push('Missing required field: upload_dir = "./dist"');
  }

  if (fields.entrypoint && String(fields.entrypoint).startsWith("/")) {
    issues.push("entrypoint must be relative to upload_dir, not an absolute path.");
  }

  if (fields.upload_dir && fields.entrypoint) {
    const uploadDir = String(fields.upload_dir).replace(/^\.\//, "").replace(/\/+$/, "");
    const entrypoint = String(fields.entrypoint).replace(/^\.\//, "");

    if (uploadDir && (entrypoint === uploadDir || entrypoint.startsWith(`${uploadDir}/`))) {
      issues.push(
        "entrypoint is relative to upload_dir; do not include the upload_dir prefix. Use entrypoint = \"index.html\" instead of repeating the build folder.",
      );
    }
  }

  if (fields.entrypoint && !String(fields.entrypoint).endsWith(".html")) {
    warnings.push("entrypoint usually points at an HTML file, commonly index.html.");
  }

  if (fields.upload_dir && /^https?:\/\//i.test(String(fields.upload_dir))) {
    issues.push("upload_dir must be a local path relative to wavedash.toml, not a URL.");
  }

  if (fields.upload_dir && String(fields.upload_dir).includes("node_modules")) {
    warnings.push("upload_dir points inside node_modules; use the production build output folder instead.");
  }

  if (sections.has("unity") && !fields["unity.version"]) {
    warnings.push('Unity configs should include [unity] version = "..." when possible.');
  }

  if (sections.has("godot") && !fields["godot.version"]) {
    warnings.push('Godot configs should include [godot] version = "..." when possible.');
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    fields,
    sections: [...sections],
  };
}

export function formatConfigValidation(result) {
  const lines = [
    result.ok ? "wavedash.toml looks valid." : "wavedash.toml needs changes.",
  ];

  if (result.issues.length > 0) {
    lines.push("", "Issues:");
    for (const issue of result.issues) lines.push(`- ${issue}`);
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }

  lines.push(
    "",
    "Expected core shape:",
    'game_id = "YOUR_GAME_ID_HERE"',
    'upload_dir = "./dist"',
    'entrypoint = "index.html"',
    "",
    "Docs: https://docs.wavedash.com/cli/configuration",
  );

  return lines.join("\n");
}
