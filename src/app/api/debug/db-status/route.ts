import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const [identity] = await sql.unsafe(`
      select current_database() as database,
             current_schema() as schema,
             current_user as user,
             current_setting('search_path') as search_path
    `);
    const objects = await sql.unsafe(`
      select
        to_regclass('public.gallery_images') is not null as gallery_images,
        to_regclass('public.homepage_media') is not null as homepage_media,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'services'
            and column_name = 'is_featured'
        ) as services_is_featured
    `);

    return NextResponse.json({ ...identity, ...objects });
  } catch (error) {
    console.error('Preview database status check failed:', error);
    return NextResponse.json({ error: 'Database check failed' }, { status: 500 });
  }
}
