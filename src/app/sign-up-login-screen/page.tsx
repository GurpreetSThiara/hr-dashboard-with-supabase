import React from 'react';
import LoginForm from './components/LoginForm';
import LoginBrandPanel from './components/LoginBrandPanel';

export default function SignUpLoginPage() {
  return (
    <div className="min-h-screen flex">
      <LoginBrandPanel />
      <LoginForm />
    </div>
  );
}