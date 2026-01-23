import React, { useState, useCallback, useMemo } from 'react';
import { transformJsonToStyleDictionary } from './services/transformer';
import { formatTokensByMode, FORMATS } from './services/formatter';
import Dropzone from './components/Dropzone';
import CodeViewer from './components/CodeViewer';
import Button from './components/Button';
import FormatSelector from './components/FormatSelector';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { basicTokens } from './exampleTokens';
import { typographyTokens } from './typographyTokens';
import { cn } from './lib/utils';

const App: React.FC = () => {
  // Store the raw transformed object instead of pre-calculated strings
  const [transformedData, setTransformedData] = useState<Record<string, object> | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState('json');
  const [fileName, setFileName] =useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [excludeParentKeys, setExcludeParentKeys] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [colorFormat, setColorFormat] = useState<'rgba' | 'oklch'>('rgba');
  
  // New state for input method
  const [inputType, setInputType] = useState<'upload' | 'paste'>('upload');
  const [pastedJson, setPastedJson] = useState('');

  const runTransformation = (jsonText: string, isNewFile: boolean) => {
    try {
      const transformedObjects = transformJsonToStyleDictionary(jsonText);
      
      setTransformedData(transformedObjects);

      if (isNewFile) {
        const modes = Object.keys(transformedObjects);
        const firstMode = modes.length > 0 ? modes[0] : null;
        setActiveMode(firstMode);
      }
      
      setError(null); // Clear any previous errors on success
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during processing.';
      setError(errorMessage);
      setTransformedData(null);
      if (isNewFile) {
        setActiveMode(null);
        setFileName(null);
      }
    }
  };

  const handleNewInput = (jsonText: string, sourceFileName: string) => {
    if (!jsonText || jsonText.trim() === '') {
        setError('Please provide valid JSON content.');
        return;
    }
    setRawJson(jsonText);
    setFileName(sourceFileName);
    runTransformation(jsonText, true);
  };

  // Dynamically calculate the code string based on current state
  const currentCode = useMemo(() => {
    if (!transformedData || !activeMode) return '';
    
    const modeData = transformedData[activeMode];
    if (!modeData) return '';

    return formatTokensByMode(
        modeData,
        outputFormat as 'json' | 'css' | 'scss' | 'w3c',
        activeMode,
        excludeParentKeys,
        prefix,
        colorFormat
    );
  }, [transformedData, activeMode, outputFormat, excludeParentKeys, prefix, colorFormat]);

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
      handleNewInput(text, file.name);
    };
    reader.onerror = () => {
      setError('File Read Error: The file could not be read. It might be corrupted or you may not have permission to access it.');
    };
    reader.readAsText(file);
  }, []);

  const handlePasteConvert = () => {
    handleNewInput(pastedJson, 'pasted-tokens.json');
  };

  const handleLoadBasicExample = useCallback(() => {
    setError(null);
    setCopyStatus('idle');
    const jsonText = JSON.stringify(basicTokens, null, 2);
    setPastedJson(jsonText);
    setInputType('paste'); 
    handleNewInput(jsonText, 'basic-tokens.json');
  }, []);

  const handleLoadTypographyExample = useCallback(() => {
    setError(null);
    setCopyStatus('idle');
    const jsonText = JSON.stringify(typographyTokens, null, 2);
    setPastedJson(jsonText);
    setInputType('paste');
    handleNewInput(jsonText, 'typography-tokens.json');
  }, []);

  const handleDownload = useCallback(() => {
    if (!currentCode || !fileName || !activeMode) return;

    const currentFormatInfo = FORMATS.find(f => f.value === outputFormat);
    if (!currentFormatInfo) return;

    const blob = new Blob([currentCode], { type: currentFormatInfo.mime });
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
  }, [currentCode, fileName, activeMode, outputFormat]);

  const handleCopy = useCallback(() => {
    if (!currentCode || copyStatus === 'copied') return;

    navigator.clipboard.writeText(currentCode).then(() => {
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  }, [currentCode, copyStatus]);

  const handleReset = () => {
    setTransformedData(null);
    setRawJson(null);
    setActiveMode(null);
    setFileName(null);
    setError(null);
    setCopyStatus('idle');
    setOutputFormat('json');
    setPastedJson('');
    setExcludeParentKeys(false);
    setPrefix('');
    setColorFormat('rgba');
  };
  
  const modes = transformedData ? Object.keys(transformedData) : [];
  const showTabs = !(modes.length === 1 && modes[0] === 'default');

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-8 sm:p-12 font-sans">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            JSON to Style Dictionary
          </h1>
          <p className="text-lg text-muted-foreground">
            Convert your design tokens into platform-specific formats instantly.
          </p>
        </header>

        <main className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-center">
                <p className="font-semibold">Encountered an issue</p>
                <p className="text-sm mt-1 opacity-90">{error}</p>
              </div>
            )}
            
            {!transformedData ? (
              <div className="space-y-6">
                {/* Input Method Switcher */}
                <div className="grid w-full grid-cols-2 p-1 bg-muted rounded-lg">
                    <button 
                        onClick={() => { setInputType('upload'); setError(null); }}
                        className={cn(
                            "rounded-md py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            inputType === 'upload' 
                                ? "bg-background shadow text-foreground" 
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Upload File
                    </button>
                    <button 
                        onClick={() => { setInputType('paste'); setError(null); }}
                        className={cn(
                            "rounded-md py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            inputType === 'paste' 
                                ? "bg-background shadow text-foreground" 
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Paste JSON
                    </button>
                </div>

                {inputType === 'upload' ? (
                    <Dropzone onFileDrop={handleFileDrop} />
                ) : (
                    <div className="space-y-4">
                        <textarea 
                            value={pastedJson}
                            onChange={(e) => setPastedJson(e.target.value)}
                            placeholder={`{\n  "color": {\n    "primary": { "$value": "#000000", "$type": "color" }\n  },\n  "typography": {\n    "heading": {\n      "$type": "typography",\n      "$value": {\n        "fontFamily": "Inter",\n        "fontSize": "32px",\n        "fontWeight": "Bold"\n      }\n    }\n  }\n}`}
                            className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                            spellCheck={false}
                        />
                        <Button 
                            onClick={handlePasteConvert} 
                            className="w-full" 
                            disabled={!pastedJson.trim()}
                        >
                            Convert JSON
                        </Button>
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 text-center pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Or start with an example
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="link" 
                      onClick={handleLoadBasicExample}
                      className="h-auto p-0 text-primary underline-offset-4 hover:underline"
                    >
                      Basic Tokens
                    </Button>
                    <span className="text-muted-foreground text-xs">•</span>
                    <Button 
                      variant="link"
                      onClick={handleLoadTypographyExample}
                      className="h-auto p-0 text-primary underline-offset-4 hover:underline"
                    >
                      Typography Tokens
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">Conversion Result</h2>
                    <p className="text-sm text-muted-foreground">
                      Source: <span className="font-medium text-foreground">{fileName}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                     <Button onClick={handleDownload} disabled={!activeMode}>
                        <DownloadIcon />
                        Download
                     </Button>
                     <Button onClick={handleReset} variant="ghost">
                       Convert Another
                     </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col w-full">
                    <FormatSelector
                      options={FORMATS.map(({value, label}) => ({value, label}))}
                      value={outputFormat}
                      onChange={(value) => { setOutputFormat(value); setCopyStatus('idle'); }}
                      excludeParentKeys={excludeParentKeys}
                      onExcludeParentKeysChange={setExcludeParentKeys}
                      prefix={prefix}
                      onPrefixChange={setPrefix}
                      colorFormat={colorFormat}
                      onColorFormatChange={setColorFormat}
                    />
                  </div>

                  {showTabs && (
                    <div className="w-full overflow-x-auto">
                      <div className="flex space-x-1 rounded-lg bg-muted p-1">
                        {modes.map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setActiveMode(mode)}
                            className={cn(
                              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              activeMode === mode
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeMode && (
                    <CodeViewer 
                        code={currentCode} 
                        onCopy={handleCopy}
                        copyStatus={copyStatus}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="text-center text-sm text-muted-foreground">
          <p>Processed securely in your browser.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;