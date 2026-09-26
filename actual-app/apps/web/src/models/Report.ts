import mongoose, { Schema, Document } from 'mongoose';

interface IStudent {
  name: string;
  enrollment: string;
  seatNumber: string;
}

export interface IReport extends Document {
  userId: string; 
  university: string; 
  title?: string;
  projectTitle: string;
  projectAdvisor: string;
  submissionMonthYear: string; 
  department: string;
  degree?: string;
  faculty?: string;
  city?: string;
  universityName?: string;
  approvalDate?: string;
  internalExaminer?: string;
  externalExaminer?: string;
  headOfDepartment?: string;
  universityLogo?: {
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
  };
  teamMembers: IStudent[];
  
  // --- Replaced hardcoded chapters with Dynamic Payloads ---
  structure: any[]; 
  contentMap: Record<string, string>; 
  // ---------------------------------------------------------

  /** Reference entries ({ id, type, authors, ... }); legacy docs may hold strings. */
  references: any[];
  /** Optional Project AI Profile for the Academic AI Copilot (P2). */
  aiProfile?: {
    projectTitle?: string;
    problemStatement?: string;
    purpose?: string;
    objectives?: string;
    targetUsers?: string;
    mainFeatures?: string;
    technologies?: string;
    projectType?: string;
    additionalContext?: string;
  };
  appendices: {
    abbreviations: { term: string; definition: string }[];
  };
  status: 'draft' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>({
  name: { type: String, default: '' },
  enrollment: { type: String, default: '' },
  seatNumber: { type: String, default: '' },
});

const ReportSchema = new Schema<IReport>(
  {
    userId: { type: String, required: true, index: true }, 
    university: { type: String, required: true, default: 'JUW' },
    title: { type: String },
    projectTitle: { type: String, required: true },
    projectAdvisor: { type: String, default: '' },
    submissionMonthYear: { type: String, default: '' },
    department: { type: String, default: 'Department of Computer Science and Software Engineering' },
    degree: { type: String, default: 'Bachelor of Science in Computer Science and Software Engineering' },
    faculty: { type: String, default: 'Faculty of Science' },
    city: { type: String, default: 'Karachi, Pakistan' },
    universityName: { type: String },
    approvalDate: { type: String, default: '' },
    internalExaminer: { type: String, default: '' },
    externalExaminer: { type: String, default: '' },
    headOfDepartment: { type: String, default: '' },
    internalExaminerDesignation: { type: String, default: '' },
    externalExaminerDesignation: { type: String, default: '' },
    externalExaminerOrganization: { type: String, default: '' },
    universityLogo: {
      dataUrl: { type: String },
      fileName: { type: String },
      mimeType: { type: String },
    },
    teamMembers: [StudentSchema],
    
    // --- Dynamic Fields Setup ---
    structure: { type: Schema.Types.Mixed, default: [] },
    contentMap: { type: Schema.Types.Mixed, default: {} },
    // ----------------------------

    references: { type: Schema.Types.Mixed, default: [] },
    aiProfile: { type: Schema.Types.Mixed, default: undefined },
    appendices: {
      abbreviations: [
        {
          term: { type: String },
          definition: { type: String },
        },
      ],
    },
    status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
  },
  { timestamps: true, minimize: false }
);

export default mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema, 'projects');