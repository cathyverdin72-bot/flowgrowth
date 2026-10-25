export type GrowthFlowProject = {
  id: string;
  title: string;
  category: "Social post" | "Story" | "Video script" | "Image concept";
  idea: string;
  updated: string;
  iconKey: "story" | "social" | "video" | "image";
  color: string;
  generatedContent?: string;
};
export type GrowthFlowBackup = {
  application: "GrowthFlow";
  version: 1;
  exportedAt: string;
  projectCount: number;
  projects: GrowthFlowProject[];
};
const BACKUP_APPLICATION = "GrowthFlow";
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_PROJECTS = 10000;
const MAX_TITLE_LENGTH = 200;
const MAX_ID_LENGTH = 200;
const MAX_IDEA_LENGTH = 10000;
const MAX_CONTENT_LENGTH = 2_000_000;
const VALID_CATEGORIES = [
  "Social post",
  "Story",
  "Video script",
  "Image concept",
] as const;
const VALID_ICON_KEYS = [
  "story",
  "social",
  "video",
  "image",
] as const;
export type BackupValidationResult =
  | {
      valid: true;
      backup: GrowthFlowBackup;
    }
  | {
      valid: false;
      error: string;
    };
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
function isNonEmptyString(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}
function validateProject(
  value: unknown,
): value is GrowthFlowProject {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !isNonEmptyString(value.id, MAX_ID_LENGTH) ||
    !isNonEmptyString(value.title, MAX_TITLE_LENGTH) ||
    !isNonEmptyString(value.idea, MAX_IDEA_LENGTH) ||
    !isNonEmptyString(value.updated, 200) ||
    !isNonEmptyString(value.color, 40)
  ) {
    return false;
  }
  if (
    !VALID_CATEGORIES.includes(
      value.category as (typeof VALID_CATEGORIES)[number],
    )
  ) {
    return false;
  }
  if (
    !VALID_ICON_KEYS.includes(
      value.iconKey as (typeof VALID_ICON_KEYS)[number],
    )
  ) {
    return false;
  }
  if (
    value.generatedContent !== undefined &&
    (typeof value.generatedContent !== "string" ||
      value.generatedContent.length > MAX_CONTENT_LENGTH)
  ) {
    return false;
  }
  return true;
}
export function createBackup(
  projects: readonly GrowthFlowProject[],
): GrowthFlowBackup {
  if (!Array.isArray(projects)) {
    throw new Error("The project list is not valid.");
  }
  if (projects.length > MAX_PROJECTS) {
    throw new Error(
      `A backup cannot contain more than ${MAX_PROJECTS} projects.`,
    );
  }
  const ids = new Set<string>();
  for (const project of projects) {
    if (!validateProject(project)) {
      throw new Error(
        "A saved project contains invalid data. The backup was not created.",
      );
    }
    if (ids.has(project.id)) {
      throw new Error(
        "Duplicate project IDs were found. The backup was not created.",
      );
    }
    ids.add(project.id);
  }
  return {
    application: BACKUP_APPLICATION,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    projectCount: projects.length,
    projects: projects.map((project) => ({ ...project })),
  };
}
export function downloadBackup(
  projects: readonly GrowthFlowProject[],
): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error(
      "File downloads are not supported in this environment.",
    );
  }
  const backup = createBackup(projects);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  if (blob.size > MAX_BACKUP_BYTES) {
    throw new Error(
      "The backup exceeds the 10 MB limit. Reduce its size before exporting.",
    );
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `growthflow-backup-${date}.json`;
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}
export function validateBackupText(
  text: string,
): BackupValidationResult {
  if (typeof text !== "string" || text.trim().length === 0) {
    return {
      valid: false,
      error: "The selected backup file is empty.",
    };
  }
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_BACKUP_BYTES) {
    return {
      valid: false,
      error: "The backup file exceeds the 10 MB limit.",
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      valid: false,
      error: "The file is not valid JSON.",
    };
  }
  if (!isRecord(parsed)) {
    return {
      valid: false,
      error: "The backup must contain a JSON object.",
    };
  }
  if (parsed.application !== BACKUP_APPLICATION) {
    return {
      valid: false,
      error: "This file is not a GrowthFlow backup.",
    };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return {
      valid: false,
      error:
        "This backup version is not supported by this version of GrowthFlow.",
    };
  }
  if (
    typeof parsed.exportedAt !== "string" ||
    Number.isNaN(Date.parse(parsed.exportedAt))
  ) {
    return {
      valid: false,
      error: "The backup export date is missing or invalid.",
    };
  }
  if (
    !Number.isInteger(parsed.projectCount) ||
    (parsed.projectCount as number) < 0
  ) {
    return {
      valid: false,
      error: "The backup project count is invalid.",
    };
  }
  if (!Array.isArray(parsed.projects)) {
    return {
      valid: false,
      error: "The backup does not contain a valid project list.",
    };
  }
  if (parsed.projects.length > MAX_PROJECTS) {
    return {
      valid: false,
      error: `The backup exceeds the ${MAX_PROJECTS}-project limit.`,
    };
  }
  if (parsed.projectCount !== parsed.projects.length) {
    return {
      valid: false,
      error:
        "The backup's project count does not match its project list.",
    };
  }
  const ids = new Set<string>();
  for (let index = 0; index < parsed.projects.length; index += 1) {
    const project: unknown = parsed.projects[index];
    if (!validateProject(project)) {
      return {
        valid: false,
        error: `Project ${index + 1} contains invalid or unsupported fields.`,
      };
    }
    if (ids.has(project.id)) {
      return {
        valid: false,
        error: `Duplicate project ID found: ${project.id}`,
      };
    }
    ids.add(project.id);
  }
  return {
    valid: true,
    backup: {
      application: BACKUP_APPLICATION,
      version: BACKUP_VERSION,
      exportedAt: parsed.exportedAt,
      projectCount: parsed.projects.length,
      projects: parsed.projects.map((project) => ({
        ...project,
      })),
    },
  };
}
export async function readBackupFile(
  file: File,
): Promise<BackupValidationResult> {
  if (!(file instanceof File)) {
    return {
      valid: false,
      error: "Select a backup file first.",
    };
  }
  if (file.size === 0) {
    return {
      valid: false,
      error: "The selected backup file is empty.",
    };
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return {
      valid: false,
      error: "The backup file exceeds the 10 MB limit.",
    };
  }
  try {
    const text = await file.text();
    return validateBackupText(text);
  } catch {
    return {
      valid: false,
      error: "The backup file could not be read.",
    };
  }
}
