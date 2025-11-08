
import React, { useState, useCallback } from 'react';
import { transformJsonToStyleDictionary } from './services/transformer';
import { formatTokensByMode, FORMATS } from './services/formatter';
import Dropzone from './components/Dropzone';
import CodeViewer from './components/CodeViewer';
import Button from './components/Button';
import FormatSelector from './components/FormatSelector';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { ClipboardIcon } from './components/icons/ClipboardIcon';

const exampleJson = {
  "color": {
    "primary": {
      "500": {
        "$type": "color",
        "$value": {
          "light": "#3b82f6",
          "dark": "#60a5fa"
        }
      }
    },
    "neutral": {
      "100": {
        "$type": "color",
        "$value": {
          "light": "#f3f4f6",
          "dark": "#1f2937"
        }
      },
      "900": {
        "$type": "color",
        "$value": {
          "light": "#111827",
          "dark": "#f9fafb"
        }
      }
    }
  },
  "font": {
    "family": {
      "sans": {
        "$type": "fontFamily",
        "$value": "Inter"
      }
    },
    "weight": {
      "regular": {
        "$type": "fontWeight",
        "$value": 400
      },
      "bold": {
        "$type": "fontWeight",
        "$value": 700
      }
    },
    "size": {
      "base": {
        "$type": "fontSize",
        "$value": 16
      },
      "large": {
        "$type": "fontSize",
        "$value": 20
      }
    },
    "line-height": {
      "base": {
        "$type": "lineHeight",
        "$value": 24
      },
      "large": {
        "$type": "lineHeight",
        "$value": 28
      }
    }
  },
  "spacing": {
    "1": {
      "$type": "spacing",
      "$value": 4
    },
    "2": {
      "$type": "spacing",
      "$value": 8
    },
    "3": {
      "$type": "spacing",
      "$value": 12
    },
    "4": {
      "$type": "spacing",
      "$value": 16
    }
  },
  "radius": {
    "sm": {
      "$type": "borderRadius",
      "$value": 4
    },
    "md": {
      "$type": "borderRadius",
      "$value": 8
    },
    "lg": {
      "$type": "borderRadius",
      "$value": 16
    }
  }
};


const App: React.FC = () => {
  const [transformedOutputs, setTransformedOutputs] = useState<Record<string, Record<string, string>> | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState('json');
  const [fileName, setFileName] =useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const processJson = (jsonText: string, sourceFileName: string) => {
    try {
      const transformedObjects = transformJsonToStyleDictionary(jsonText);
      
      const outputs: Record<string, Record<string, string>> = {};
      let firstMode: string | null = null;
      
      for (const mode in transformedObjects) {
        if (!firstMode) {
          firstMode = mode;
        }
        outputs[mode] = {};
        for (const format of FORMATS) {
            outputs[mode][format.value] = formatTokensByMode(
                transformedObjects[mode],
                format.value as 'json' | 'css' | 'scss' | 'w3c',
                mode
            );
        }
      }

      setTransformedOutputs(outputs);
      setActiveMode(firstMode);
      setFileName(sourceFileName);
      setOutputFormat('json');
      setError(null); // Clear any previous errors on success
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during processing.';
      setError(errorMessage);
      setTransformedOutputs(null);
      setActiveMode(null);
      setFileName(null);
    }
  }

  const handleFileDrop = useCallback((file: File) => {
    setError(null);
    setCopyStatus('idle');
    if (!file) return;

    if (file.type !== 'application/json') {
      setError('Invalid File Type: Please upload a file with a .json extension.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text || text.trim() === '') {
        setError('File Error: The selected file is empty.');
        return;
      }
      processJson(text, file.name);
    };
    reader.onerror = () => {
      setError('File Read Error: The file could not be read. It might be corrupted or you may not have permission to access it.');
    };
    reader.readAsText(file);
  }, []);

  const handleLoadExample = useCallback(() => {
    setError(null);
    setCopyStatus('idle');
    const jsonText = JSON.stringify(exampleJson, null, 2);
    processJson(jsonText, 'example.json');
  }, []);

  const handleDownload = useCallback(() => {
    if (!transformedOutputs || !fileName || !activeMode) return;

    const currentFormatInfo = FORMATS.find(f => f.value === outputFormat);
    if (!currentFormatInfo) return;

    const contentToDownload = transformedOutputs[activeMode]?.[outputFormat];
    if (!contentToDownload) return;

    const blob = new Blob([contentToDownload], { type: currentFormatInfo.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const baseName = fileName.replace('.json', '');
    const modeSuffix = activeMode === 'default' ? '' : `.${activeMode}`;
    const newFileName = `${baseName}${modeSuffix}.${currentFormatInfo.extension}`;

    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transformedOutputs, fileName, activeMode, outputFormat]);

  const handleCopy = useCallback(() => {
    if (!transformedOutputs || !activeMode || copyStatus === 'copied') return;

    const contentToCopy = transformedOutputs[activeMode]?.[outputFormat];
    if (!contentToCopy) return;

    navigator.clipboard.writeText(contentToCopy).then(() => {
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  }, [transformedOutputs, activeMode, outputFormat, copyStatus]);

  const handleReset = () => {
    setTransformedOutputs(null);
    setActiveMode(null);
    setFileName(null);
    setError(null);
    setCopyStatus('idle');
    setOutputFormat('json');
  };
  
  const modes = transformedOutputs ? Object.keys(transformedOutputs) : [];
  const showTabs = !(modes.length === 1 && modes[0] === 'default');

  const currentCode = (activeMode && transformedOutputs && transformedOutputs[activeMode]?.[outputFormat]) 
    ? transformedOutputs[activeMode][outputFormat] 
    : '';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">JSON to Style Dictionary Converter</h1>
          <p className="mt-4 text-lg text-slate-400">
            Upload your design tokens in JSON format to automatically convert them into various formats.
          </p>
        </header>

        <main className="bg-slate-800 rounded-xl shadow-2xl shadow-cyan-500/10 p-6 transition-all duration-300">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 text-center">
              <p className="font-semibold">Encountered an issue:</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}
          
          {!transformedOutputs ? (
            <>
              <Dropzone onFileDrop={handleFileDrop} />
              <div className="text-center mt-4">
                <p className="text-slate-400">
                  Don't have a file?{' '}
                  <button 
                    onClick={handleLoadExample} 
                    className="text-cyan-400 hover:text-cyan-300 font-semibold underline focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                    aria-label="Load an example JSON file"
                  >
                    Try our example.
                  </button>
                </p>
              </div>
            </>
          ) : (
            <div>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">Conversion Result</h2>
                  <p className="text-slate-400 mt-1">
                    Converted <span className="font-semibold text-cyan-400">{fileName}</span>
                  </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap justify-start md:justify-end">
                  <Button onClick={handleCopy} variant="secondary" disabled={!activeMode || copyStatus === 'copied'}>
                    <ClipboardIcon />
                    {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                  </Button>
                   <Button onClick={handleDownload} disabled={!activeMode}>
                      <DownloadIcon />
                      Download
                   </Button>
                   <Button onClick={handleReset} variant="secondary">
                     Convert Another
                   </Button>
                </div>
              </div>

              <div className="mb-4">
                <FormatSelector
                  options={FORMATS.map(({value, label}) => ({value, label}))}
                  value={outputFormat}
                  onChange={(value) => { setOutputFormat(value); setCopyStatus('idle'); }}
                />
              </div>

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

              {activeMode && (
                <CodeViewer code={currentCode} />
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
