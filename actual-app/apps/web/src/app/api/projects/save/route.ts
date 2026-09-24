import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, chapterId, content } = body;

    // 1. Validation
    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid Project ID format" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("reportpeer"); // <-- Ensure this is your CORRECT Database Name

    // 2. Debugging: Log what we are looking for
    console.log("Searching for Project ID:", projectId);
    console.log("Searching for Chapter ID:", chapterId);

    // 3. Update Operation
    // Update Operation
    const result = await db.collection("projects").findOneAndUpdate(
      { _id: new ObjectId(projectId) }, // Find by ID
      {
        $set: {
          [`contentMap.${chapterId}`]: content, 
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // 4. Check Result
    // In MongoDB driver, findOneAndUpdate returns the document or null if not found
    if (!result) {
      console.error("Query failed: Document or Chapter not found for:", { projectId, chapterId });
      return NextResponse.json({ error: "Project or Chapter not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error("DEBUG ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error }, { status: 500 });
  }
}