import React from 'react';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const FEATURES = [
  { id: 'feat-employees', icon: 'UsersIcon', title: 'Employee Lifecycle Management', desc: 'Onboard, manage, and offboard employees with full audit trails.' },
  { id: 'feat-payroll', icon: 'BanknotesIcon', title: 'Automated Payroll Processing', desc: 'Run payroll with tax calculations, compliance checks, and instant payslips.' },
  { id: 'feat-performance', icon: 'StarIcon', title: 'Performance & Appraisals', desc: '360° reviews, goal tracking, and calibrated compensation adjustments.' },
  { id: 'feat-compliance', icon: 'ShieldCheckIcon', title: 'Compliance & Audit Ready', desc: 'Stay ahead of regulatory deadlines with automated alerts and reports.' },
];

export default function LoginBrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between w-[52%] xl:w-[55%] p-12 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #1e3a8a 0%, #1d4ed8 45%, #2563eb 100%)',
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 right-1/4 w-64 h-64 rounded-full bg-white/5" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <AppLogo size={40} />
          <span className="text-2xl font-bold text-white tracking-tight">HRCore</span>
        </div>
        <p className="text-blue-200 text-sm mt-2 font-medium">Enterprise HR Management Platform</p>
      </div>

      {/* Hero text */}
      <div className="relative z-10 my-8">
        <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
          Your people.<br />
          Your platform.<br />
          <span className="text-blue-300">One place.</span>
        </h2>
        <p className="text-blue-100 text-base leading-relaxed max-w-sm">
          HRCore gives corporate HR teams complete control over the employee lifecycle — from first offer letter to final settlement.
        </p>
      </div>

      {/* Features */}
      <div className="relative z-10 space-y-4">
        {FEATURES.map((f) => (
          <div key={f.id} className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name={f.icon as Parameters<typeof Icon>[0]['name']} size={17} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{f.title}</p>
              <p className="text-blue-200 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-8 pt-6 border-t border-white/15">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">4,200+</p>
            <p className="text-blue-200 text-xs">Employees Managed</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">98.4%</p>
            <p className="text-blue-200 text-xs">Payroll Accuracy</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">18</p>
            <p className="text-blue-200 text-xs">Role Tiers</p>
          </div>
        </div>
      </div>
    </div>
  );
}