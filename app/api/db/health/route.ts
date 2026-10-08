import { NextResponse } from 'next/server.js';
import { prisma } from '../../../../lib/prisma.ts';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      database: 'postgresql',
      status: 'ok',
    });
  } catch (error) {
    console.error('[DB Health] PostgreSQL connection failed:', error);
    return NextResponse.json(
      {
        database: 'postgresql',
        status: 'error',
        message: 'Database PostgreSQL belum tersambung atau belum siap.',
      },
      { status: 503 }
    );
  }
}
