import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';

export async function GET() {
  try {
    // Attempt to connect to MongoDB Atlas
    await connectToDatabase();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connected successfully! 🎉 ReportPeer is live.' 
    });
  } catch (error: any) {
    console.error('Database connection error details:', error);
    
    return NextResponse.json({ 
      success: false, 
      message: 'Database connection failed! ❌',
      error: error.message 
    }, { status: 500 });
  }
}