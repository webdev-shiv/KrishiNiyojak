import React from 'react';
import { AlertTriangle, Database, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';
import { isSupabaseConfigured } from '../api/supabaseClient';

export function SupabaseStatusBanner({ error, onRetry, title = 'Database Connection Notice' }) {
  if (!error && isSupabaseConfigured) return null;

  const isMissingKeys = !isSupabaseConfigured || error?.code === 'UNCONFIGURED';

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs mb-6 text-amber-900 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
            {isMissingKeys ? <KeyRound className="w-5 h-5" /> : <Database className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
              <span>{isMissingKeys ? 'Supabase Credentials Required' : title}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200/80 text-amber-800">
                Single Source of Truth
              </span>
            </h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              {isMissingKeys ? (
                <>
                  Demo fallbacks are strictly disabled. Please configure{' '}
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">
                    VITE_SUPABASE_URL
                  </code>{' '}
                  and{' '}
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">
                    VITE_SUPABASE_PUBLISHABLE_KEY
                  </code>{' '}
                  in your <code className="font-mono font-bold">frontend/.env</code> to connect this screen to live PostgreSQL data.
                </>
              ) : (
                error?.message || 'Unable to fetch real-time records from Supabase database.'
              )}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Query</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default SupabaseStatusBanner;
