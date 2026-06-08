// src/app/api/auth/token/route.js
import { NextResponse } from 'next/server';

// This function handles GET requests to the route
export async function GET(request) {
  // Get the cookie from the request
  const accessToken = request.cookies.get('access_token')?.value || null;

  // If no token is found, return a 401 Unauthorized response
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return the accessToken as JSON
  return NextResponse.json({ accessToken });
}
