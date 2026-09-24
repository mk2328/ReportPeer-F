import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

export type ReportListItem = {
  id?: string;
  text: string;
  level?: number;
};

export type ReportContentList = {
  id?: string;
  type: "bullet" | "number" | string;
  items: Array<string | ReportListItem>;
  level?: number;
};

export type ReportTable = {
  id?: string;
  caption?: string;
  columns?: string[];
  data?: string[][];
  rows?: string[][];
};

export type ReportFigure = {
  id?: string;
  caption?: string;
  title?: string;
  path?: string;
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  data?: string;
};

export type ReportStructureItem = {
  id: string;
  title: string;
  level?: number;
  subitems?: ReportStructureItem[];
  lists?: ReportContentList[];
  tables?: ReportTable[];
  figures?: ReportFigure[];
};

export type ReportTeamMember = {
  name?: string;
  enrollment?: string;
  seatNumber?: string;
};

export type ReportMeta = {
  projectTitle?: string;
  projectAdvisor?: string;
  supervisor?: string;
  department?: string;
  faculty?: string;
  city?: string;
  degree?: string;
  submissionMonthYear?: string;
  approvalDate?: string;
  universityName?: string;
  internalExaminer?: string;
  externalExaminer?: string;
  headOfDepartment?: string;
  internalExaminerDesignation?: string;
  externalExaminerDesignation?: string;
  externalExaminerOrganization?: string;
  teamMembers?: ReportTeamMember[];
  students?: ReportTeamMember[];
  logoPath?: string;
  logoDataUrl?: string;
  universityLogo?: {
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
    path?: string;
  };
};

export type ReportProjectInput = {
  title?: string;
  university?: string;
  structure: ReportStructureItem[];
  contentMap: Record<string, string>;
  meta?: ReportMeta;
  projectTitle?: string;
  projectAdvisor?: string;
  department?: string;
  submissionMonthYear?: string;
  teamMembers?: ReportTeamMember[];
  universityLogo?: {
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
  };
};

export type GeneratedReport = {
  buffer: Buffer;
  filename: string;
};

const ENGINE_ROOT = path.resolve(
  process.env.REPORTPEER_ENGINE_ROOT || path.join(process.cwd(), "..", "engine")
);

const GENERATE_TIMEOUT_MS = 120_000;

export async function generateProjectDocx(project: ReportProjectInput): Promise<GeneratedReport> {
  if (!Array.isArray(project.structure) || project.structure.length === 0) {
    throw new ReportGenerationError("Project structure is empty.", 400);
  }

  const pythonPath = await resolvePythonPath();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "reportpeer-"));
  const inputPath = path.join(workDir, "payload.json");
  const outputPath = path.join(workDir, "report.docx");

  let logoPath: string | undefined;
  const logoDataUrl =
    project.meta?.logoDataUrl ||
    project.meta?.universityLogo?.dataUrl ||
    project.universityLogo?.dataUrl;
  if (logoDataUrl && logoDataUrl.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;charset=[^;]+)?;base64,(.+)$/i.exec(logoDataUrl);
    if (match) {
      const mime = (match[1] || "image/png").toLowerCase();
      const ext = mime.includes("png")
        ? ".png"
        : mime.includes("jpeg") || mime.includes("jpg")
          ? ".jpg"
          : mime.includes("gif")
            ? ".gif"
            : mime.includes("webp")
              ? ".webp"
              : ".png";
      logoPath = path.join(workDir, `university-logo${ext}`);
      const bytes = Buffer.from(match[3], "base64");
      if (!bytes.length) {
        throw new ReportGenerationError("University logo data is empty.", 400);
      }
      await fs.writeFile(logoPath, bytes);
      const stat = await fs.stat(logoPath);
      if (!stat.size) {
        throw new ReportGenerationError("Failed to write university logo file.", 500);
      }
    }
  }

  const payload = {
    title: project.title || project.projectTitle || project.meta?.projectTitle || "FYP Report",
    university: project.university || "JUW",
    structure: project.structure,
    contentMap: project.contentMap || {},
    meta: {
      ...(project.meta || {}),
      projectTitle:
        project.meta?.projectTitle ||
        project.projectTitle ||
        project.title ||
        "FYP Report",
      projectAdvisor:
        project.meta?.projectAdvisor ||
        project.meta?.supervisor ||
        project.projectAdvisor ||
        "",
      supervisor:
        project.meta?.supervisor ||
        project.meta?.projectAdvisor ||
        project.projectAdvisor ||
        "",
      department: project.meta?.department || project.department || "",
      submissionMonthYear:
        project.meta?.submissionMonthYear || project.submissionMonthYear || "",
      teamMembers:
        project.meta?.teamMembers ||
        project.meta?.students ||
        project.teamMembers ||
        [],
      students:
        project.meta?.students ||
        project.meta?.teamMembers ||
        project.teamMembers ||
        [],
      university: project.university || "JUW",
      universityName: project.meta?.universityName,
      faculty: project.meta?.faculty,
      city: project.meta?.city,
      degree: project.meta?.degree,
      approvalDate: project.meta?.approvalDate,
      internalExaminer: project.meta?.internalExaminer,
      externalExaminer: project.meta?.externalExaminer,
      headOfDepartment: project.meta?.headOfDepartment,
      internalExaminerDesignation: project.meta?.internalExaminerDesignation,
      externalExaminerDesignation: project.meta?.externalExaminerDesignation,
      externalExaminerOrganization: project.meta?.externalExaminerOrganization,
      logoPath,
      // Keep data URL as fallback for the engine if the temp path is unavailable.
      logoDataUrl: logoPath ? undefined : logoDataUrl,
      universityLogo: logoPath
        ? { ...(project.meta?.universityLogo || project.universityLogo || {}), path: logoPath }
        : project.meta?.universityLogo || project.universityLogo || undefined,
    },
  };

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");

    const result = await runProcess(
      pythonPath,
      ["generate.py", "--input", inputPath, "--output", outputPath],
      ENGINE_ROOT,
      GENERATE_TIMEOUT_MS
    );

    if (result.code !== 0) {
      const details = extractEngineError(result.stderr, result.stdout);
      throw new ReportGenerationError(details || "Report generation failed.", 500);
    }

    const buffer = await readFileWhenReady(outputPath);
    if (!buffer.length) {
      throw new ReportGenerationError("The engine produced an empty document.", 500);
    }

    return {
      buffer,
      filename: buildDownloadFilename(project.title),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export class ReportGenerationError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ReportGenerationError";
    this.status = status;
  }
}

function buildDownloadFilename(title?: string) {
  const cleaned = (title || "FYP_Report")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "")
    .slice(0, 80);
  return `${cleaned || "FYP_Report"}.docx`;
}

async function resolvePythonPath() {
  const configured = process.env.REPORTPEER_PYTHON;
  if (configured) {
    await assertFileExists(configured, "Configured REPORTPEER_PYTHON was not found.");
    return configured;
  }

  const windowsVenv = path.join(ENGINE_ROOT, "venv", "Scripts", "python.exe");
  const unixVenv = path.join(ENGINE_ROOT, "venv", "bin", "python");

  if (await exists(windowsVenv)) return windowsVenv;
  if (await exists(unixVenv)) return unixVenv;

  throw new ReportGenerationError(
    "Python engine runtime was not found. Install the engine venv or set REPORTPEER_PYTHON.",
    500
  );
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new ReportGenerationError("Report generation timed out.", 504));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new ReportGenerationError(`Could not start the report engine: ${error.message}`, 500));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function extractEngineError(stderr: string, stdout: string) {
  for (const stream of [stderr, stdout]) {
    const trimmed = stream.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error) return String(parsed.error);
    } catch {
      return trimmed.split("\n").filter(Boolean).slice(-3).join(" ");
    }
  }
  return "";
}

async function readFileWhenReady(filePath: string, attempts = 15, delayMs = 200): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertFileExists(filePath: string, message: string) {
  if (!(await exists(filePath))) {
    throw new ReportGenerationError(message, 500);
  }
}
