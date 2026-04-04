'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Phone, Loader2, Shield } from 'lucide-react';

export default function AgentLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyPhone, setCompanyPhone] = useState('6281234567890');

  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const res = await fetch('/api/company');
        if (res.ok) {
          const data = await res.json();
          if (data.phone) {
            let formattedPhone = data.phone.replace(/^0/, '62');
            if (!formattedPhone.startsWith('62')) formattedPhone = '62' + formattedPhone;
            setCompanyPhone(formattedPhone);
          }
        }
      } catch (error) { console.error('Failed to fetch company settings:', error); }
    };
    fetchCompanySettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('agentData', JSON.stringify(data.agent));
        router.push('/agent/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl shadow-lg mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Agent Portal</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Login dengan nomor HP terdaftar</p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Phone className="w-3 h-3" />
                Nomor HP
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-2.5 py-2 rounded-lg text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white text-sm font-medium rounded-lg transition"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Logging in...</>
              ) : (
                <><LogIn className="w-4 h-4" />Login</>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Belum terdaftar?{' '}
              <a href={`https://wa.me/${companyPhone}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 font-medium">
                Hubungi Admin
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-500 dark:text-gray-400 mt-4">
          Powered by AIBILL RADIUS
        </p>
      </div>
    </div>
  );
}
