import React from 'react';
import { Camera, Zap } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-brand-800 bg-brand-950 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white text-brand-950 rounded-sm flex items-center justify-center">
          <Camera size={20} strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-xl font-semibold tracking-wide text-white">LUMIÈRE <span className="font-sans text-xs font-normal text-brand-400 tracking-normal ml-1">AI STUDIO</span></h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Clean header: removed Powered by badge and User avatar */}
      </div>
    </header>
  );
};

export default Header;