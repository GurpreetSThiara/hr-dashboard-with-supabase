'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history?.back();
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50/50 p-4 overflow-hidden font-sans">
      {/* Decorative Animated Background Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/40 blur-[120px] animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 blur-[120px] animate-pulse duration-[6000ms]" />
      
      <div className="relative z-10 w-full max-w-lg bg-white border border-slate-100/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm p-6 sm:p-10 transition-all duration-300">
        
        {/* Header Branding */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-ping" />
            <span className="text-xs font-semibold text-blue-700 tracking-wider uppercase">HRCore Platform</span>
          </div>
        </div>

        {/* 404 Illustration & Text */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <h1 className="text-8xl sm:text-9xl font-black tracking-tight bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-500 bg-clip-text text-transparent select-none animate-pulse duration-[4000ms]">
              404
            </h1>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mt-6 tracking-tight">
            Lost in Space?
          </h2>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm sm:text-base">
            The page you're trying to reach doesn't exist, has been moved, or is temporarily offline. Let's get you back on track!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <button
            onClick={handleGoBack}
            className="btn-secondary group flex items-center justify-center gap-2 px-6 py-3 font-medium active:scale-95"
          >
            <Icon 
              name="ArrowLeftIcon" 
              size={18} 
              className="text-slate-500 group-hover:-translate-x-1 transition-transform" 
            />
            Go Back
          </button>
          <Link
            href="/hr-dashboard"
            className="btn-primary group flex items-center justify-center gap-2 px-6 py-3 font-medium active:scale-95"
          >
            <Icon name="HomeIcon" size={18} className="text-white" />
            Go to Dashboard
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">
            Need help? Contact your administrator or check the{' '}
            <Link href="/organization" className="text-blue-600 hover:underline font-medium">
              Company Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}