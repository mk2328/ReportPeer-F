import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    // 1. Frontend se 'level' aur 'title' bhi receive karein
    const { projectId, title, level } = await req.json();

    if (!projectId || !title || level === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("reportpeer");
    const newId = new ObjectId().toString();

    // 2. Atomic Update: 'level' aur 'title' ke saath save karein
    const result = await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $push: { 
          structure: { 
            id: newId, 
            title: title,    // Title pass karein
            level: level,    // Level pass karein
            subitems: [] 
          } 
        },
        $set: { 
          [`contentMap.${newId}`]: "" 
        }
      } as any
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, newId: newId });
    
  } catch (error) {
    console.error("Add Subheading Error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}