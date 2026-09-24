import mongoose, { Schema, Document } from 'mongoose';

// 1. TypeScript Interface for Project
export interface IProject extends Document {
  userId: string;
  title: string;
  university: string;
  structure: any[]; // Recursive structure ke liye
  contentMap: Record<string, string>; // ID to Content mapping ke liye
  lastUpdated: Date;
}

// 2. Mongoose Schema
const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    university: { type: String, default: "JUW" }, 
    
    
    // Flexible fields
    structure: { type: Schema.Types.Mixed, default: [] },
    contentMap: { type: Schema.Types.Mixed, default: {} },
    
    lastUpdated: { type: Date, default: Date.now }
  }, 
  { minimize: false } // Bohat zaroori hai empty {} save karne ke liye
);

// 3. Export Model
export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);