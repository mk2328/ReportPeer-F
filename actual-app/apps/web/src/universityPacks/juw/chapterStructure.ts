/**
 * JUW chapter/section list for AI guides.
 * Must stay aligned with apps/engine/templates/juw/config.json → chapter_structure.
 */

import type { UniversityChapterDef } from "@/universityPacks/types";

export const JUW_CHAPTER_STRUCTURE: readonly UniversityChapterDef[] = [
  {
    chapter: 1,
    title: "Introduction",
    sections: ["Overview", "Purpose", "Stakeholders", "Benefits", "Background Study"],
  },
  {
    chapter: 2,
    title: "Requirements",
    sections: ["Functional Requirements", "Non-Functional Requirements"],
  },
  {
    chapter: 3,
    title: "Analysis and Design",
    sections: [
      "System Architecture",
      "Entity Relationship Diagram",
      "Project Flow Diagram",
      "Use Cases",
      "Activity Diagram",
      "User Interface Design",
    ],
  },
  {
    chapter: 4,
    title: "Project Plan",
    sections: [
      "Process Model",
      "User Stories",
      "Sprint Planning",
      "Sprint Sizing",
      "Timeline with Milestones",
    ],
  },
  {
    chapter: 5,
    title: "Test Plan",
    sections: ["Test Cases", "Automated Testing Tools"],
  },
  {
    chapter: 6,
    title: "Implementation Details",
    sections: [
      "Tools and Technology",
      "Data Dictionary",
      "Version Control",
      "Web APIs",
      "Website Development",
      "Mobile Application Development",
      "Deployment",
      "Website Hosting",
      "Mobile Application Deployment",
    ],
  },
  {
    chapter: 7,
    title: "Conclusion and Future Work",
    sections: [],
  },
] as const;
