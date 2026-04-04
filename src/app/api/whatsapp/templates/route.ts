import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Default templates
const defaultTemplates = [
  {
    name: 'Persetujuan Pendaftaran',
    type: 'registration-approval',
    message: `🎉 *Selamat! Pendaftaran Anda Disetujui*

Halo *{{customerName}}*,

Pendaftaran internet Anda telah disetujui oleh admin {{companyName}}.

📋 *Detail Akun PPPoE:*
━━━━━━━━━━━━━━━━━━
👤 Username: *{{username}}*
🔐 Password: *{{password}}*
📦 Paket: *{{profileName}}*
━━━━━━━━━━━━━━━━━━

💰 *Biaya Instalasi:* {{installationFee}}

📌 *Langkah Selanjutnya:*
1. Tim teknis kami akan menghubungi Anda untuk jadwal instalasi
2. Setelah instalasi selesai, Anda akan menerima invoice pembayaran
3. Setelah pembayaran lunas, internet Anda akan aktif

⚠️ *PENTING:*
- Simpan username dan password Anda dengan baik
- Jangan berikan informasi ini kepada orang lain

📞 Butuh bantuan? Hubungi: {{companyPhone}}

Terima kasih telah memilih {{companyName}}! 🙏`,
  },
  {
    name: 'Invoice Instalasi',
    type: 'installation-invoice',
    message: `🧾 *Invoice Instalasi*

Halo *{{customerName}}*,

Instalasi internet Anda telah selesai! 🎉

📋 *Detail Invoice:*
━━━━━━━━━━━━━━━━━━
🧾 No Invoice: *{{invoiceNumber}}*
💰 Total: *{{amount}}*
📅 Jatuh Tempo: *{{dueDate}}*
━━━━━━━━━━━━━━━━━━

💳 *Link Pembayaran:*
{{paymentLink}}

📌 *Cara Bayar:*
1. Klik link di atas
2. Pilih metode pembayaran
3. Selesaikan pembayaran
4. Internet Anda akan aktif otomatis!

⚠️ *Catatan:*
Akun Anda saat ini dalam status *ISOLATED* (terbatas). Setelah pembayaran lunas, akun akan diaktifkan otomatis dan Anda bisa menggunakan internet dengan kecepatan penuh.

📞 Butuh bantuan? Hubungi: {{companyPhone}}

Terima kasih! 🙏`,
  },
  {
    name: 'Invoice Bulanan / Jatuh Tempo',
    type: 'invoice-reminder',
    message: `📅 *Reminder Invoice Bulanan*

Halo *{{customerName}}*,

Ini adalah pengingat untuk invoice internet bulanan Anda.

📋 *Detail Invoice:*
━━━━━━━━━━━━━━━━━━
👤 Username: *{{username}}*
🧾 No Invoice: *{{invoiceNumber}}*
💰 Total: *{{amount}}*
📅 Jatuh Tempo: *{{dueDate}}*
⏰ Sisa Waktu: *{{daysRemaining}} hari*
━━━━━━━━━━━━━━━━━━

💳 *Link Pembayaran:*
{{paymentLink}}

📌 *Cara Bayar:*
1. Klik link pembayaran di atas
2. Pilih metode pembayaran yang Anda inginkan
3. Selesaikan pembayaran sebelum jatuh tempo
4. Layanan akan diperpanjang otomatis

⚠️ *Penting:*
Harap segera lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari pemutusan layanan.

📞 Butuh bantuan? Hubungi: {{companyPhone}}

Terima kasih atas kepercayaan Anda! 🙏
{{companyName}}`,
  },
  {
    name: 'Admin Create User Manual',
    type: 'admin-create-user',
    message: `🎉 *Akun Internet Anda Telah Dibuat!*

Halo *{{customerName}}*,

Admin telah membuatkan akun internet untuk Anda.

📋 *Detail Akun PPPoE:*
━━━━━━━━━━━━━━━━━━
👤 Username: *{{username}}*
🔐 Password: *{{password}}*
📦 Paket: *{{profileName}}*
━━━━━━━━━━━━━━━━━━

🚀 *Status:* AKTIF
Internet Anda sudah bisa digunakan!

💡 *Tips:*
- Simpan username & password Anda
- Koneksi PPPoE akan otomatis tersambung
- Invoice bulanan akan dikirim otomatis setiap bulan

📞 Butuh bantuan? Hubungi: {{companyPhone}}

Terima kasih telah menggunakan {{companyName}}! 🙏`,
  },
  {
    name: 'Pembayaran Berhasil',
    type: 'payment-success',
    message: `✅ *Pembayaran Berhasil!*

Halo *{{customerName}}*,

Pembayaran invoice {{invoiceNumber}} sebesar *{{amount}}* telah kami terima.

🎉 *Internet Anda Sudah AKTIF!*

📋 *Detail Akun:*
━━━━━━━━━━━━━━━━━━
👤 Username: *{{username}}*
🔐 Password: *{{password}}*
📦 Paket: *{{profileName}}*
━━━━━━━━━━━━━━━━━━

🚀 *Internet sudah otomatis aktif!*
Anda dapat langsung menggunakan internet sekarang. Koneksi PPPoE Anda akan otomatis tersambung.

💡 *Tips:*
- Simpan username & password Anda untuk keperluan troubleshooting
- Hubungi kami jika ada kendala koneksi
- Invoice bulanan akan dikirim otomatis setiap bulan
- Pastikan perangkat Anda sudah terhubung ke router

📞 Butuh bantuan? Hubungi: {{companyPhone}}

Terima kasih telah mempercayai {{companyName}}! 🙏

Selamat berselancar! 🌐`,
  },
  {
    name: 'Informasi Gangguan',
    type: 'maintenance-outage',
    message: `⚠️ *Informasi Gangguan Jaringan*

Halo *{{customerName}}*,

Kami informasikan bahwa saat ini terjadi gangguan pada jaringan internet kami.

📋 *Detail Gangguan:*
━━━━━━━━━━━━━━━━━━
🔧 Jenis: *{{issueType}}*
📍 Area Terdampak: *{{affectedArea}}*
📝 Keterangan: {{description}}
⏰ Estimasi Pemulihan: *{{estimatedTime}}*
━━━━━━━━━━━━━━━━━━

🔄 *Status:* Sedang dalam perbaikan

Tim teknis kami sedang bekerja untuk mengatasi gangguan ini secepat mungkin. Kami mohon maaf atas ketidaknyamanan yang ditimbulkan.

📌 *Update:*
Kami akan menginformasikan kembali jika layanan sudah pulih normal.

📞 Butuh bantuan? Hubungi: {{companyPhone}}

Terima kasih atas pengertian Anda.
{{companyName}} 🙏`,
  },
];

// GET - List all templates (auto-seed if empty or missing)
export async function GET() {
  try {
    let templates = await prisma.whatsapp_templates.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Auto-seed default templates if none exist
    if (templates.length === 0) {
      console.log('[Templates] No templates found, creating defaults...');
      
      for (const defaultTemplate of defaultTemplates) {
        await prisma.whatsapp_templates.create({
          data: {
            id: crypto.randomUUID(),
            name: defaultTemplate.name,
            type: defaultTemplate.type,
            message: defaultTemplate.message,
            isActive: true,
          },
        });
      }
      
      // Fetch again after seeding
      templates = await prisma.whatsapp_templates.findMany({
        orderBy: { createdAt: 'asc' },
      });
      
      console.log(`[Templates] ✅ Created ${templates.length} default templates`);
    } else {
      // Check for missing templates and add them
      const existingTypes = templates.map(t => t.type);
      const missingTemplates = defaultTemplates.filter(dt => !existingTypes.includes(dt.type));
      
      if (missingTemplates.length > 0) {
        console.log(`[Templates] Adding ${missingTemplates.length} missing templates...`);
        
        for (const missingTemplate of missingTemplates) {
          await prisma.whatsapp_templates.create({
            data: {
              id: crypto.randomUUID(),
              name: missingTemplate.name,
              type: missingTemplate.type,
              message: missingTemplate.message,
              isActive: true,
            },
          });
        }
        
        // Fetch again after adding missing templates
        templates = await prisma.whatsapp_templates.findMany({
          orderBy: { createdAt: 'asc' },
        });
        
        console.log(`[Templates] ✅ Added missing templates: ${missingTemplates.map(t => t.type).join(', ')}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST - Create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, message, isActive } = body;

    if (!name || !type || !message) {
      return NextResponse.json(
        { success: false, error: 'Name, type, and message are required' },
        { status: 400 }
      );
    }

    const template = await prisma.whatsapp_templates.create({
      data: {
        id: crypto.randomUUID(),
        name,
        type,
        message,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
