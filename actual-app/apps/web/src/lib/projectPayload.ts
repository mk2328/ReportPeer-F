/**
 * Slim project JSON for faster editor first paint.
 * Strips large base64 dataUrls without changing the Mongo schema.
 */

const DATA_URL_KEEP_MAX = 256;

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripValue);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(obj)) {
      if (
        key === "dataUrl" &&
        typeof nested === "string" &&
        nested.length > DATA_URL_KEEP_MAX
      ) {
        out[key] = "";
        continue;
      }
      out[key] = stripValue(nested);
    }
    return out;
  }
  return value;
}

/** Return a JSON-safe clone with large `dataUrl` strings cleared. */
export function slimProjectPayload<T>(project: T): T {
  return stripValue(project) as T;
}

/**
 * Critical-path payload for editor interactivity.
 * Omits AI profile, diagram specs, references, and binary media (stripped dataUrls).
 * Full document is fetched afterward in the background.
 */
export function buildLiteProjectPayload(project: Record<string, unknown>): Record<string, unknown> {
  const slim = slimProjectPayload(project) as Record<string, unknown>;
  const logo = slim.universityLogo;
  let universityLogo: unknown = null;
  if (logo && typeof logo === "object") {
    const { dataUrl: _omit, ...meta } = logo as Record<string, unknown>;
    universityLogo = Object.keys(meta).length ? meta : null;
  }

  return {
    _id: slim._id,
    userId: slim.userId,
    title: slim.title,
    university: slim.university,
    status: slim.status,
    updatedAt: slim.updatedAt,
    createdAt: slim.createdAt,
    structure: slim.structure ?? [],
    contentMap: slim.contentMap ?? {},
    projectTitle: slim.projectTitle,
    projectAdvisor: slim.projectAdvisor,
    department: slim.department,
    degree: slim.degree,
    faculty: slim.faculty,
    city: slim.city,
    universityName: slim.universityName,
    submissionMonthYear: slim.submissionMonthYear,
    approvalDate: slim.approvalDate,
    teamMembers: slim.teamMembers,
    internalExaminer: slim.internalExaminer,
    internalExaminerDesignation: slim.internalExaminerDesignation,
    externalExaminer: slim.externalExaminer,
    externalExaminerDesignation: slim.externalExaminerDesignation,
    externalExaminerOrganization: slim.externalExaminerOrganization,
    headOfDepartment: slim.headOfDepartment,
    universityLogo,
    // Deferred — filled by background full GET
    references: [],
    aiProfile: undefined,
    diagramSpecs: undefined,
    _lite: true,
  };
}
