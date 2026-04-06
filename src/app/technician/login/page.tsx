'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Phone, KeyRound, ArrowRight, Loader2, Wrench } from 'lucide-react';
import { showSuccess, showError } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';

export default function TechnicianLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/technician/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.requireOtp === false) {
          // Bypass OTP natively
          await showSuccess('Login successful');
          router.push('/technician');
          return;
        }
        await showSuccess('Kode OTP telah dikirim ke WhatsApp Anda');
        setStep(2);
      } else {
        await showError(data.error || 'Gagal mengirim OTP');
      }
    } catch (error) {
      await showError('Terjadi kesalahan saat memproses OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/technician/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otpCode }),
      });

      const data = await res.json();

      if (res.ok) {
        await showSuccess('Login Berhasil');
        router.push('/technician');
      } else {
        await showError(data.error || 'Kode OTP tidak valid');
      }
    } catch (error) {
      await showError('Terjadi kesalahan verifikasi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-background to-background"></div>
      
      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-[1px] mb-8 shadow-[0_0_30px_rgba(34,211,238,0.3)] animate-bounce-slow">
          <div className="w-full h-full bg-background rounded-[15px] flex items-center justify-center">
            <Wrench className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            AIBILL TECHNICIAN
          </h1>
          <p className="text-sm text-cyan-400/60 font-medium max-w-xs">
            {step === 1 
              ? 'Masukkan nomor akun teknisi Anda untuk melanjutkan' 
              : `Kode OTP telah dikirim ke nomor WhatsApp:\n${phoneNumber}`
            }
          </p>
        </div>

        <div className="w-full bg-card/40 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-6 shadow-xl">
          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4 fade-in">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-cyan-400/80 uppercase tracking-widest pl-1">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-cyan-500/50" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-background/50 border border-cyan-500/30 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium text-lg"
                    placeholder="081234..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !phoneNumber}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl p-[1px] disabled:opacity-50 mt-6"
              >
                <div className="w-full bg-cyan-500 group-hover:bg-cyan-500/90 transition-colors py-3.5 rounded-[11px] flex justify-center items-center gap-2">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <>
                      <span className="font-bold text-white text-sm tracking-wide">Kirim Kode OTP</span>
                      <ArrowRight className="w-4 h-4 text-white" />
                    </>
                  )}
                </div>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 fade-in">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-cyan-400/80 uppercase tracking-widest pl-1">
                  Verifikasi 6-Digit OTP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-cyan-500/50" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="block w-full pl-11 pr-4 py-3.5 bg-background/50 border border-cyan-500/30 rounded-xl text-center tracking-[0.5em] text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-bold text-2xl"
                    placeholder="------"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl p-[1px] disabled:opacity-50 mt-6"
              >
                <div className="w-full bg-cyan-500 group-hover:bg-cyan-500/90 transition-colors py-3.5 rounded-[11px] flex justify-center items-center gap-2">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <>
                      <Shield className="w-4 h-4 text-white" />
                      <span className="font-bold text-white text-sm tracking-wide">Verifikasi MASUK</span>
                    </>
                  )}
                </div>
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-cyan-400/70 hover:text-cyan-400 transition-colors"
                >
                  Ganti Nomor WhatsApp
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      <div className="mt-8 text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest relative z-10">
        AIBILL FIELD TECHNICIAN SECURE PORTAL
      </div>
    </div>
  );
}
