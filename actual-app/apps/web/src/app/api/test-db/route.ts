import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    await client.db("reportpeer").command({ ping: 1 });

    return NextResponse.json({
      success: true,
      message: "Database connected successfully.",
    });
  } catch (error: unknown) {
    console.error("Database connection error details:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
