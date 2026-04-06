import { prisma } from './prisma';

export async function getCompanyName(): Promise<string> {
  try {
    const company = await prisma.company.findFirst({
      select: { name: true }
    });
    return company?.name || 'NexaRadius';
  } catch (error) {
    console.error('Error fetching company name:', error);
    return 'NexaRadius';
  }
}

export async function getCompanyInfo() {
  try {
    const company = await prisma.company.findFirst();
    return company || {
      name: 'NexaRadius',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    };
  } catch (error) {
    console.error('Error fetching company info:', error);
    return {
      name: 'NexaRadius',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    };
  }
}
