import React, { useState, useCallback } from 'react';
import { transformJsonToStyleDictionary } from './services/transformer';
import Dropzone from './components/Dropzone';
import CodeViewer from './components/CodeViewer';
import Button from './components/Button';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { ClipboardIcon } from './components/icons/ClipboardIcon';

const App: React.FC = () => {
  const [transformedJsons, setTransformedJsons] = useState<Record<string, string> | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [fileName, setFileName] =useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const handleFileDrop = useCallback((file: File) => {
    setError(null);
    setCopyStatus('idle');
    if (!file || file.type !== 'application/json') {
      setError('Invalid file type. Please upload a JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('File is empty.');
        }
        const transformedObjects = transformJsonToStyleDictionary(text);
        
        const stringifiedJsons: Record<string, string> = {};
        let firstMode: string | null = null;
        for (const mode in transformedObjects) {
          if (!firstMode) {
            firstMode = mode;
          }
          stringifiedJsons[mode] = JSON.stringify(transformedObjects[mode], null, 2);
        }

        setTransformedJsons(stringifiedJsons);
        setActiveMode(firstMode);
        setFileName(file.name);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during parsing.';
        setError(`Error processing file: ${errorMessage}`);
        setTransformedJsons(null);
        setActiveMode(null);
        setFileName(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
    };
    reader.readAsText(file);
  }, []);

  const handleDownload = useCallback(() => {
    if (!transformedJsons || !fileName || !activeMode) return;

    const jsonToDownload = transformedJsons[activeMode];
    if (!jsonToDownload) return;

    const blob = new Blob([jsonToDownload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const baseName = fileName.replace('.json', '');
    const modeSuffix = activeMode === 'default' ? '' : `.${activeMode}`;
    const newFileName = `${baseName}${modeSuffix}.sd.json`;

    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transformedJsons, fileName, activeMode]);

  const handleCopy = useCallback(() => {
    if (!transformedJsons || !activeMode || copyStatus === 'copied') return;

    const jsonToCopy = transformedJsons[activeMode];
    if (!jsonToCopy) return;

    navigator.clipboard.writeText(jsonToCopy).then(() => {
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  }, [transformedJsons, activeMode, copyStatus]);

  const handleReset = () => {
    setTransformedJsons(null);
    setActiveMode(null);
    setFileName(null);
    setError(null);
    setCopyStatus('idle');
  };
  
  const modes = transformedJsons ? Object.keys(transformedJsons) : [];
  const showTabs = !(modes.length === 1 && modes[0] === 'default');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">JSON to Style Dictionary Converter</h1>
          <p className="mt-4 text-lg text-slate-400">
            Upload your design tokens in JSON format to automatically convert them into the Style Dictionary structure.
          </p>
        </header>

        <main className="bg-slate-800 rounded-xl shadow-2xl shadow-cyan-500/10 p-6 transition-all duration-300">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 text-center">
              <p>{error}</p>
            </div>
          )}
          
          {!transformedJsons ? (
            <Dropzone onFileDrop={handleFileDrop} />
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="text-2xl font-semibold text-slate-100">Conversion Result</h2>
                <div className="flex gap-4">
                  <Button onClick={handleCopy} variant="secondary" disabled={!activeMode || copyStatus === 'copied'}>
                    <ClipboardIcon />
                    {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                  </Button>
                   <Button onClick={handleDownload} disabled={!activeMode}>
                      <DownloadIcon />
                      Download {activeMode === 'default' ? 'JSON' : `'${activeMode}' JSON`}
                   </Button>
                   <Button onClick={handleReset} variant="secondary">
                     Convert Another File
                   </Button>
                </div>
              </div>
              <p className="text-slate-400 mb-4">
                Converted <span className="font-semibold text-cyan-400">{fileName}</span>
              </p>

              {showTabs && (
                <div className="border-b border-slate-700 mb-4">
                  <nav className="-mb-px flex gap-6" aria-label="Tabs">
                    {modes.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={`${
                          activeMode === mode
                            ? 'border-cyan-400 text-cyan-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                        } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                        aria-current={activeMode === mode ? 'page' : undefined}
                      >
                        {mode}
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {activeMode && transformedJsons[activeMode] && (
                <CodeViewer code={transformedJsons[activeMode]} />
              )}
            </div>
          )}
        </main>
        <footer className="text-center mt-8 text-slate-500 text-sm">
            <p>Client-side processing. Your files never leave your browser.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;