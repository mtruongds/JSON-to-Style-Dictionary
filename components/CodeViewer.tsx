
import React from 'react';

interface CodeViewerProps {
  code: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code }) => {
  return (
    <div className="bg-slate-900/70 rounded-lg border border-slate-700 max-h-[50vh] overflow-auto">
      <pre className="p-4 text-sm text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeViewer;
