import { NextResponse } from 'next/server';
import { getActiveAddons } from '@/lib/pricing';

export async function GET() {
  try {
    const addons = await getActiveAddons();
    return NextResponse.json({ addons });
  } catch (error) {
    console.error('Error fetching addons:', error);
    return NextResponse.json({ 
      addons: [] 
    });
  }
}
