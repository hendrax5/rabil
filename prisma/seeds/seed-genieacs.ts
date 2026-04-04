import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-32';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function generateStrongPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 24; i++) {
        pass += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return pass;
}

async function run() {
  const existingSettings = await prisma.genieacsSettings.findFirst({ where: { isActive: true }});
  const strongPassword = generateStrongPassword();
  
  if (existingSettings) {
    await prisma.genieacsSettings.update({
      where: { id: existingSettings.id },
      data: { username: "admin", password: encrypt(strongPassword) }
    });
    console.log(`Secured ACS configuration with auto-generated strong 24-character password: ${strongPassword}`);
  }
}

run().finally(() => prisma.$disconnect());
