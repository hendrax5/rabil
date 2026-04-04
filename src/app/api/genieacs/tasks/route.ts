import { NextResponse } from 'next/server';
import { getGenieACSCredentials } from '@/app/api/settings/genieacs/route';

export async function GET() {
  try {
    // Get GenieACS credentials
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json({ tasks: [] });
    }

    const { host, username, password } = credentials;

    if (!host) {
      return NextResponse.json({ tasks: [] });
    }

    const authHeader = Buffer.from(`${username}:${password}`).toString('base64');

    // Fetch tasks from GenieACS
    const response = await fetch(`${host}/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch tasks from GenieACS:', response.status);
      return NextResponse.json({ tasks: [], error: 'Failed to fetch tasks' });
    }

    const tasks = await response.json();

    return NextResponse.json({ 
      success: true, 
      tasks: tasks || [] 
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, tasks: [], error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
