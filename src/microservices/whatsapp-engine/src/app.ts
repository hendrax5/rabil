import express from 'express';
import { PrismaClient } from '@prisma/client';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } from '@whiskeysockets/baileys';
import Pino from 'pino';
import * as QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import crypto from 'crypto';

const app = express();
const port = 3006;
const prisma = new PrismaClient();
const logger = Pino({ level: 'silent' });

let client: ReturnType<typeof makeWASocket> | null = null;
let qrCodeImage: string | null = null;
let connectionState: 'connecting' | 'open' | 'close' | 'qr' = 'connecting';

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '25', 10);
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || '30000', 10);
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || '60000', 10);

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('sessions');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  client = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    syncFullHistory: false
  });

  client.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      connectionState = 'qr';
      qrCodeImage = await QRCode.toDataURL(qr);
      console.log('QR Code generated! Scan via Web API.');
    }

    if (connection === 'close') {
      qrCodeImage = null;
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed, reconnecting:', shouldReconnect);
      connectionState = 'close';
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      } else {
        console.log('Logged out. Please restart container or delete session folder to rescan.');
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connection opened successfully!');
      connectionState = 'open';
      qrCodeImage = null;
    }
  });

  client.ev.on('creds.update', saveCreds);
}

// Queue Polling Engine
async function processQueue() {
  if (connectionState !== 'open' || !client) {
    return; // Wait until connected
  }

  try {
    // Check if we are currently holding a processing batch
    const processingBatch = await prisma.whatsapp_queue.findMany({
      where: { status: 'PROCESSING', providerType: 'BAILEYS_LOCAL' }
    });

    if (processingBatch.length > 0) {
      return; // Await current batch completion
    }

    // Fetch next chunk
    const pendingJobs = await prisma.whatsapp_queue.findMany({
      where: {
        status: 'PENDING',
        providerType: 'BAILEYS_LOCAL',
        scheduledAt: { lte: new Date() }
      },
      orderBy: { scheduledAt: 'asc' },
      take: CHUNK_SIZE
    });

    if (pendingJobs.length === 0) return;

    console.log(`[Queue Runner] Processing batch of ${pendingJobs.length} messages (max: ${CHUNK_SIZE})`);

    // Lock jobs
    const jobIds = pendingJobs.map((j: any) => j.id);
    await prisma.whatsapp_queue.updateMany({
      where: { id: { in: jobIds } },
      data: { status: 'PROCESSING', attempts: { increment: 1 } }
    });

    for (let i = 0; i < pendingJobs.length; i++) {
        const job = pendingJobs[i];
        let targetJid = job.targetNumber;
        if (targetJid.startsWith('08')) {
            targetJid = '628' + targetJid.substring(2);
        } else if (targetJid.startsWith('8')) {
            targetJid = '628' + targetJid.substring(1);
        }
        if (!targetJid.endsWith('@s.whatsapp.net')) {
            targetJid = targetJid + '@s.whatsapp.net';
        }

        try {
            const onWaResult = await client.onWhatsApp(targetJid);
            const result = onWaResult?.[0];
            if (result && result.exists) {
                await client.sendMessage(targetJid, { text: job.message });
                console.log(`[Sent] Message to ${job.targetNumber}`);
                
                await prisma.whatsapp_queue.update({
                    where: { id: job.id },
                    data: { status: 'SENT', processedAt: new Date() }
                });

                // Also copy to history for dashboard visualization
                await prisma.whatsapp_history.create({
                    data: {
                        id: crypto.randomUUID(),
                        phone: job.targetNumber,
                        message: job.message,
                        status: 'SENT',
                        providerName: 'Baileys Local Worker',
                        providerType: 'BAILEYS_LOCAL'
                    }
                });
            } else {
                console.log(`[Failed] Number not on WA: ${job.targetNumber}`);
                await prisma.whatsapp_queue.update({
                    where: { id: job.id },
                    data: { status: 'FAILED' }
                });
            }
        } catch (err: any) {
             console.error(`[Failed] Exception on ${job.targetNumber}:`, err.message);
             await prisma.whatsapp_queue.update({
                where: { id: job.id },
                data: { status: 'FAILED' }
             });
        }

        if (i < pendingJobs.length - 1) {
            const randomDelay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1) + MIN_DELAY_MS);
            console.log(`[Queue Runner] Waiting ${randomDelay / 1000}s before next message...`);
            await delay(randomDelay);
        }
    }
    console.log(`[Queue Runner] Batch complete.`);
  } catch (error) {
    console.error('Queue error:', error);
  }
}

// Check queue every 15 seconds
setInterval(processQueue, 15000);

// Set CORS for Next.js dashboard
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/api/status', (req: express.Request, res: express.Response) => {
  res.json({
    status: connectionState,
    qrImage: qrCodeImage
  });
});

app.listen(port, () => {
  console.log(`WhatsApp Baileys Worker started on port ${port}`);
  console.log(`Config: CHUNK=${CHUNK_SIZE}, DELAY=${MIN_DELAY_MS/1000}s-${MAX_DELAY_MS/1000}s`);
  connectToWhatsApp();
});
