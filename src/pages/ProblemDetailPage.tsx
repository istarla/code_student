import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { ChevronLeft, Loader2, Play, Send, Bookmark, RotateCcw, Monitor, Type, Sun, Moon, Lightbulb, LightbulbOff, Settings, Keyboard, Maximize2, Minimize2, ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProblem, useRunCode, useSubmitCode, useAddBookmark, useRemoveBookmark, useLanguages } from "@/hooks/useApi";
import { toast } from "sonner";
import DifficultyBadge from "@/components/DifficultyBadge";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";

const MONACO_LANGUAGE_MAP: Record<string | number, string> = {
  javascript: "javascript",
  python: "python",
  java: "java",
  cpp: "cpp",
  c: "c",
  go: "go",
  rust: "rust",
  typescript: "typescript",
  ruby: "ruby",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  scala: "scala",
  csharp: "csharp",
  // Map Judge0 IDs back to Monaco languages
  63: "javascript",
  71: "python",
  62: "java",
  54: "cpp",
  50: "c",
  60: "go",
  73: "rust",
  74: "typescript",
  72: "ruby",
  68: "php",
  83: "swift",
  78: "kotlin",
  81: "scala",
  51: "csharp",
};

// Supported language IDs from backend's LANGUAGE_IDS mapping
const SUPPORTED_LANGUAGE_IDS = new Set([71, 62, 54, 50, 63, 74, 60, 73, 72, 68, 83, 78, 81, 51]);

// No driver code needed - using real backend execution

// Default boilerplate templates for each language
const getBoilerplate = (language: string): string => {
  const templates: Record<string, string> = {
    javascript: `// Write your solution here
function solution() {
    // Your code goes here
    
}

solution();`,
    python: `# Write your solution here
def solution():
    # Your code goes here
    pass

if __name__ == "__main__":
    solution()`,
    java: `public class Solution {
    public static void main(String[] args) {
        // Write your solution here
        
    }
}`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    // Write your solution here
    
    return 0;
}`,
    c: `#include <stdio.h>

int main() {
    // Write your solution here
    
    return 0;
}`,
    go: `package main

import "fmt"

func main() {
    // Write your solution here
    
}`,
    rust: `fn main() {
    // Write your solution here
    
}`,
    typescript: `// Write your solution here
function solution(): void {
    // Your code goes here
    
}

solution();`,
    ruby: `# Write your solution here
def solution
    # Your code goes here
    
end

solution`,
    php: `<?php
// Write your solution here
function solution() {
    // Your code goes here
    
}

solution();
?>`,
    swift: `import Foundation

// Write your solution here
func solution() {
    // Your code goes here
    
}

solution()`,
    kotlin: `fun main() {
    // Write your solution here
    
}`,
    scala: `object Solution {
    def main(args: Array[String]): Unit = {
        // Write your solution here
        
    }
}`,
    csharp: `using System;

class Solution {
    static void Main() {
        // Write your solution here
        
    }
}`
  };
  
  return templates[language] || `// Write your solution here\n`;
};

// Helper to map Judge0 names/IDs to slugs expected by the backend
const getLanguageSlug = (lang: any): string => {
  if (lang.value) return lang.value;
  
  const langId = typeof lang.id === 'string' ? parseInt(lang.id) : lang.id;
  
  // Map by Judge0 ID first (most reliable)
  const idToSlug: Record<number, string> = {
    71: 'python',
    62: 'java',
    54: 'cpp',
    50: 'c',
    63: 'javascript',
    74: 'typescript',
    60: 'go',
    73: 'rust',
    72: 'ruby',
    68: 'php',
    83: 'swift',
    78: 'kotlin',
    81: 'scala',
    51: 'csharp',
  };
  
  if (idToSlug[langId]) return idToSlug[langId];
  
  // Fallback to name parsing
  const name = (lang.name || "").toLowerCase().trim();
  if (name.includes('javascript') || name.includes('node.js')) return 'javascript';
  if (name.includes('typescript')) return 'typescript';
  if (name.includes('python')) return 'python';
  if (name.includes('java') && !name.includes('javascript')) return 'java';
  if (name.includes('c++') || name.includes('cpp')) return 'cpp';
  if (name.includes('gcc') && name.includes('c') && !name.includes('c++')) return 'c';
  if (name.includes('go')) return 'go';
  if (name.includes('rust')) return 'rust';
  if (name.includes('ruby')) return 'ruby';
  if (name.includes('php')) return 'php';
  if (name.includes('swift')) return 'swift';
  if (name.includes('kotlin')) return 'kotlin';
  if (name.includes('scala')) return 'scala';
  if (name.includes('c#') || name.includes('csharp')) return 'csharp';
  
  return 'javascript'; // safe default
};

const ProblemDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [language, setLanguage] = useState<string>("javascript");
  const [code, setCode] = useState("");
  const [activeBottomTab, setActiveBottomTab] = useState<"testcase" | "result">("testcase");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [customOutput, setCustomOutput] = useState("");
  const [isCustomInputActive, setIsCustomInputActive] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  
  // Editor customization states
  const [fontSize, setFontSize] = useState(14);
  const [pageTheme, setPageTheme] = useState<'dark' | 'light'>('dark');
  const [intelliSenseEnabled, setIntelliSenseEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
  const [editorRef, setEditorRef] = useState<any>(null); // Store editor instance
  
  // Fetch languages
  const { data: languagesData } = useLanguages();
  const rawLanguages = languagesData || [];
  
  // Filter to only backend-supported languages
  const languages = useMemo(() => {
    if (!rawLanguages || rawLanguages.length === 0) return [];
    
    return rawLanguages.filter((lang: any) => {
      const langId = typeof lang.id === 'string' ? parseInt(lang.id) : lang.id;
      return SUPPORTED_LANGUAGE_IDS.has(langId);
    });
  }, [rawLanguages]);
  
  // Fetch problem details
  const { data: problem, isLoading } = useProblem(id!);

  // Mutations
  const runCodeMutation = useRunCode(id!);
  const submitCodeMutation = useSubmitCode(id!);
  const addBookmarkMut = useAddBookmark();
  const removeBookmarkMut = useRemoveBookmark();

  // Update test results when run code mutation succeeds
  useEffect(() => {
    if (runCodeMutation.data) {
      setTestResults(runCodeMutation.data.testResults || []);
      setActiveBottomTab("result");
    }
  }, [runCodeMutation.data]);

  // Update test results when submit code mutation succeeds (includes hidden test cases)
  useEffect(() => {
    if (submitCodeMutation.data) {
      setTestResults(submitCodeMutation.data.results || submitCodeMutation.data.testResults || []);
      setActiveBottomTab("result");
    }
  }, [submitCodeMutation.data]);

  // Set initial code when problem loads
  useEffect(() => {
    if (problem && language) {
      // Always use boilerplate since backend only has one starterCode (not per-language)
      setCode(getBoilerplate(language));
    }
  }, [problem]);

  // Update boilerplate when language changes
  useEffect(() => {
    if (language) {
      setCode(getBoilerplate(language));
    }
  }, [language]);

  // Set initial language when languages load
  useEffect(() => {
    if (languages.length > 0) {
      // If current language is undefined or not in the list, set to first available
      const isValidLanguage = languages.find((l: any) => getLanguageSlug(l) === language);
      if (!language || !isValidLanguage) {
        const initialLang = getLanguageSlug(languages[0]);
        setLanguage(initialLang);
      }
    } else if (!language) {
      setLanguage('javascript');
    }
  }, [languages, language]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Ctrl + / : Toggle shortcuts panel
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShortcutsDialogOpen(prev => !prev);
        return;
      }

      // Ctrl + Enter : Run code
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleRun();
        return;
      }

      // Ctrl + Shift + Enter : Submit code
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // F11 : Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Esc : Exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
        return;
      }

      // Ctrl + Shift + F : Format code
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleFormatCode();
        return;
      }

      // Ctrl + R : Reset code
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        handleResetCode();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [code, language, isFullscreen]); // Dependencies for the handlers

  const handleRun = () => {
    if (!code.trim()) {
      toast.error("Code cannot be empty");
      return;
    }

    if (!language) {
      toast.error("Please select a language");
      return;
    }

    runCodeMutation.mutate({ 
      code, // Sending user's code as is
      language: language as string, 
      customInput: isCustomInputActive ? customInput : undefined 
    }, {
      onError: (err: any) => {
        toast.error(err.message || "Execution Error");
      }
    });
  };

  const handleSubmit = () => {
    if (!code.trim()) {
      toast.error("Code cannot be empty");
      return;
    }

    if (!language) {
      toast.error("Please select a language");
      return;
    }

    submitCodeMutation.mutate({ 
      code, // Sending user's code as is
      language: language as string 
    }, {
      onSuccess: () => {
        toast.success("Solution submitted successfully!");
        if (activeBottomTab !== "result") setActiveBottomTab("result");
      },
      onError: (err: any) => {
        toast.error(err.message || "Submission Failed");
      }
    });
  };

  const toggleBookmark = () => {
    if (!problem) return;
    if (problem.isBookmarked) {
      removeBookmarkMut.mutate(problem.id);
    } else {
      addBookmarkMut.mutate(problem.id);
    }
  };

  const handleResetCode = () => {
    setCode(getBoilerplate(language));
    toast.success("Code reset to boilerplate");
  };

  // Format code
  const handleFormatCode = () => {
    if (editorRef) {
      editorRef.getAction('editor.action.formatDocument').run().then(() => {
        toast.success("Code formatted successfully!");
      });
    }
  };

  const handleEditorDidMount = (editor: any) => {
    setEditorRef(editor);
  };

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 2, 30));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 2, 10));
  const toggleTheme = () => setPageTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleFullscreen = () => setIsFullscreen(prev => !prev);
  const toggleIntelliSense = () => setIntelliSenseEnabled(prev => !prev);

  // Close settings dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (settingsOpen && !target.closest('.settings-dropdown')) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  // ... (isLoading and !problem checks remain the same) ...

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Problem not found
      </div>
    );
  }

  // ... (derived state for results remains the same) ...

  const isRunning = runCodeMutation.isPending;
  const isSubmitting = submitCodeMutation.isPending;
  const isBookmarking = addBookmarkMut.isPending || removeBookmarkMut.isPending;

  return (
    <div className={`h-screen flex flex-col ${pageTheme === 'light' ? 'bg-gray-50' : 'bg-background'}`}>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL: Description */}
        <div className={`w-1/2 border-r overflow-y-auto ${
          pageTheme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-background border-border'
        }`}>
          {/* Header inside left panel */}
          <div className={`px-6 py-4 border-b sticky top-0 z-10 ${
            pageTheme === 'light' 
              ? 'bg-white border-gray-200' 
              : 'bg-background border-border'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link to="/problems" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className={`font-semibold text-lg ${
                  pageTheme === 'light' ? 'text-gray-900' : ''
                }`}>{problem.title}</h1>
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground font-mono">
                  {problem.timeLimit}ms | {problem.memoryLimit}MB
                </div>
                <button
                  onClick={toggleBookmark}
                  disabled={isBookmarking}
                  className={`p-2 rounded-full transition-colors hover:bg-muted ${
                    problem.isBookmarked 
                      ? "text-yellow-500" 
                      : "text-muted-foreground"
                  }`}
                  title={problem.isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
                >
                  <Bookmark 
                    className={`w-5 h-5 transition-all ${
                      problem.isBookmarked ? "fill-current scale-110" : "scale-100"
                    }`} 
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Description */}
            <div>

              <h2 className="font-bold text-xl mb-4">
                Problem Description
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: problem.description }} />
              </div>
            </div>

            {/* Example - Side by Side */}

            <div className="space-y-3">
              <h3 className="font-semibold text-base">Example</h3>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-muted-foreground mb-2 font-medium text-sm">Input:</div>
                    <div className="font-mono text-sm text-foreground whitespace-pre-wrap">{problem.sampleInput}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-2 font-medium text-sm">Output:</div>
                    <div className="font-mono text-sm text-foreground whitespace-pre-wrap">{problem.sampleOutput}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Constraints */}
            <div className="space-y-2">
              <h3 className="font-semibold text-base">Constraints</h3>
              <pre className="bg-muted/30 p-4 rounded-lg border border-border/50 font-mono text-sm text-muted-foreground whitespace-pre-wrap">
                {problem.constraints}
              </pre>
            </div>

            {/* Hint - Collapsible */}
            <details className="border-2 border-yellow-500/50 rounded-lg bg-yellow-500/5">
              <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-yellow-500/10 transition-colors rounded-lg">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">Hint</span>
              </summary>
              <div className="px-4 pb-3 pt-2 text-sm text-muted-foreground border-t border-yellow-500/20">
                {problem.hints && problem.hints.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {problem.hints.map((hint: string, idx: number) => (
                      <li key={idx}>{hint}</li>
                    ))}
                  </ul>
                ) : problem.hint ? (
                  <p>{problem.hint}</p>
                ) : (
                  <p className="text-muted-foreground/70 italic">No hints available for this problem.</p>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* RIGHT PANEL: Editor & Console */}
        <div className={`${isFullscreen ? 'w-full' : 'w-1/2'} flex flex-col ${
          pageTheme === 'light' 
            ? 'bg-gray-100 text-gray-900' 
            : 'bg-[#1e1e1e] text-white'
        }`}>

          {/* TOOLBAR */}
          <div className={`h-14 flex items-center justify-between px-4 border-b shadow-sm relative z-10 ${
            pageTheme === 'light'
              ? 'bg-white border-gray-300'
              : 'bg-[#1e1e1e] border-white/10'
          }`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] rounded-md border border-white/5 shadow-inner">
                <Monitor className="w-4 h-4 text-primary" />
                <Select 
                  value={language || "javascript"} 
                  onValueChange={(val) => {
                    if (val && typeof val === 'string') {
                      setLanguage(val);
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px] h-7 bg-transparent text-white border-transparent focus:ring-0 p-0 text-sm font-medium">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d2d2d] border-white/10 text-white shadow-2xl">
                    {languages.length > 0 ? (
                      (() => {
                        const uniqueLanguages = new Map();
                        languages.forEach((lang: any) => {
                          const slug = getLanguageSlug(lang);
                          if (!uniqueLanguages.has(slug)) {
                            uniqueLanguages.set(slug, lang);
                          }
                        });
                        
                        return Array.from(uniqueLanguages.values()).map((lang: any) => {
                          const langValue = getLanguageSlug(lang);
                          return (
                            <SelectItem key={lang.id || langValue} value={langValue} className="hover:bg-white/5 focus:bg-white/10">
                              {lang.name}
                            </SelectItem>
                          );
                        });
                      })()
                    ) : (
                      <>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                        <SelectItem value="c">C</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={handleResetCode}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all duration-200 group relative"
                title="Reset to starter code"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform duration-300" />
              </button>
              
              {/* Settings Button */}
              <div className="relative settings-dropdown">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all duration-200"
                  title="Editor Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                
                {/* Settings Dropdown - Opens to the LEFT */}
                {settingsOpen && (
                  <div className="absolute top-12 left-0 w-64 bg-[#2d2d2d]/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-2xl z-50 animate-in slide-in-from-top-2">
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <h3 className="font-semibold text-xs">Editor Settings</h3>
                        <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none">
                          ×
                        </button>
                      </div>
                      
                      {/* Font Size */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-medium">Font Size</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={decreaseFontSize}
                            className="p-1.5 bg-[#1e1e1e] hover:bg-[#252525] rounded transition-colors"
                          >
                            <Type className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono flex-1 text-center bg-[#1e1e1e] py-1.5 rounded">{fontSize}px</span>
                          <button
                            onClick={increaseFontSize}
                            className="p-1.5 bg-[#1e1e1e] hover:bg-[#252525] rounded transition-colors"
                          >
                            <Type className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Theme */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-medium">Theme</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPageTheme('dark')}
                            className={`flex-1 p-1.5 rounded flex items-center justify-center gap-1.5 transition-colors text-xs ${
                              pageTheme === 'dark' 
                                ? 'bg-primary text-white' 
                                : 'bg-[#1e1e1e] text-gray-400 hover:bg-[#252525]'
                            }`}
                          >
                            <Moon className="w-3 h-3" />
                            <span>Dark</span>
                          </button>
                          <button
                            onClick={() => setPageTheme('light')}
                            className={`flex-1 p-1.5 rounded flex items-center justify-center gap-1.5 transition-colors text-xs ${
                              pageTheme === 'light' 
                                ? 'bg-primary text-white' 
                                : 'bg-[#1e1e1e] text-gray-400 hover:bg-[#252525]'
                            }`}
                          >
                            <Sun className="w-3 h-3" />
                            <span>Light</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* IntelliSense */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-medium">IntelliSense</label>
                        <button
                          onClick={toggleIntelliSense}
                          className={`w-full p-2 rounded flex items-center justify-between transition-colors ${
                            intelliSenseEnabled 
                              ? 'bg-yellow-500/20 border border-yellow-500/50' 
                              : 'bg-[#1e1e1e] border border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {intelliSenseEnabled ? (
                              <Lightbulb className="w-3 h-3 text-yellow-500" />
                            ) : (
                              <LightbulbOff className="w-3 h-3 text-gray-400" />
                            )}
                            <span className="text-xs">Suggestions</span>
                          </div>
                          <span className={`text-xs font-medium ${
                            intelliSenseEnabled ? 'text-yellow-500' : 'text-gray-500'
                          }`}>
                            {intelliSenseEnabled ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Format Code Button */}
              <button
                onClick={handleFormatCode}
                title="Format Code (Ctrl+Shift+F)"
                className={`p-2 rounded-md transition-colors ${
                  pageTheme === 'light'
                    ? 'hover:bg-gray-200 text-gray-700'
                    : 'hover:bg-[#2d2d2d] text-gray-300'
                }`}
              >
                <Type className="w-4 h-4" />
              </button>

              {/* Keyboard Shortcuts Button */}
              <button
                onClick={() => setShortcutsDialogOpen(true)}
                title="Keyboard Shortcuts (Ctrl+/)"
                className={`p-2 rounded-md transition-colors ${
                  pageTheme === 'light'
                    ? 'hover:bg-gray-200 text-gray-700'
                    : 'hover:bg-[#2d2d2d] text-gray-300'
                }`}
              >
                <Keyboard className="w-4 h-4" />
              </button>

              {/* Fullscreen Toggle Button */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F11)"}
                className={`p-2 rounded-md transition-colors ${
                  pageTheme === 'light'
                    ? 'hover:bg-gray-200 text-gray-700'
                    : 'hover:bg-[#2d2d2d] text-gray-300'
                }`}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRun}
                disabled={isRunning || isSubmitting}
                className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 disabled:opacity-50 px-5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border border-white/5 shadow-sm active:scale-95"
              >
               {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
               Run
              </button>
              <button
                onClick={handleSubmit}
                disabled={isRunning || isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white disabled:opacity-50 px-6 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 shadow-md shadow-green-900/20 active:scale-95 border border-green-500/20"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
            <div className="absolute inset-0 pointer-events-none border-t border-white/5 z-10" />
            <Editor
              height="100%"
              language={MONACO_LANGUAGE_MAP[language]}
              value={code}
              onMount={handleEditorDidMount}
              onChange={(v) => setCode(v || "")}
              theme={pageTheme === 'light' ? 'light' : 'vs-dark'}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
                lineHeight: 24,
                letterSpacing: 0.5,
                automaticLayout: true,
                padding: { top: 20, bottom: 20 },
                scrollBeyondLastLine: false,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                roundedSelection: true,
                renderLineHighlight: 'all',
                formatOnPaste: true,
                formatOnType: true,
                renderValidationDecorations: 'on', // Enable syntax error highlighting
                lineNumbersMinChars: 3,
                scrollbar: {
                  vertical: 'visible',
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                  useShadows: false,
                },
                // IntelliSense settings
                suggestOnTriggerCharacters: intelliSenseEnabled,
                quickSuggestions: intelliSenseEnabled ? {
                  other: true,
                  comments: false,
                  strings: false,
                } : false,
                parameterHints: {
                  enabled: intelliSenseEnabled,
                },
                suggest: {
                  showKeywords: intelliSenseEnabled,
                  showSnippets: intelliSenseEnabled,
                },
              }} 
            />
          </div>

          {/* BOTTOM PANEL - LeetCode Style */}
          <div className={`border-t flex flex-col transition-all duration-300 ease-in-out ${
            isBottomPanelOpen ? 'h-80' : 'h-10'
          } ${
            pageTheme === 'light'
              ? 'bg-white border-gray-300'
              : 'bg-[#1e1e1e] border-white/10'
          }`}>
            
            {/* TABS HEADER */}
            <div className={`flex items-center justify-between px-2 border-b text-sm font-medium ${
              pageTheme === 'light'
                ? 'bg-gray-50 border-gray-300'
                : 'bg-[#1e1e1e] border-white/10'
            }`}>
              <div className="flex">
                <button
                  onClick={() => {
                    setActiveBottomTab("testcase");
                    if (!isBottomPanelOpen) setIsBottomPanelOpen(true);
                  }}
                  className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
                    activeBottomTab === "testcase" && isBottomPanelOpen
                      ? pageTheme === 'light'
                        ? "border-primary text-gray-900" 
                        : "border-white text-white"
                      : pageTheme === 'light'
                        ? "border-transparent text-gray-500 hover:text-gray-700"
                        : "border-transparent text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Testcase
                </button>
                <button
                  onClick={() => {
                    setActiveBottomTab("result");
                    if (!isBottomPanelOpen) setIsBottomPanelOpen(true);
                  }}
                  className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
                    activeBottomTab === "result" && isBottomPanelOpen
                      ? pageTheme === 'light'
                        ? "border-primary text-gray-900" 
                        : "border-white text-white"
                      : pageTheme === 'light'
                        ? "border-transparent text-gray-500 hover:text-gray-700"
                        : "border-transparent text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Test Result
                </button>
              </div>

              {/* Toggle Panel Button */}
              <button
                onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                className={`p-1 rounded hover:bg-white/10 transition-colors ${
                  pageTheme === 'light' ? 'text-gray-500 hover:bg-gray-200' : 'text-gray-400'
                }`}
                title={isBottomPanelOpen ? "Collapse Panel" : "Expand Panel"}
              >
                {isBottomPanelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>


            {/* PANEL CONTENT */}
            {isBottomPanelOpen && (
              <div className="flex-1 overflow-y-auto p-4">
              
              {/* === TESTCASES TAB === */}
              {activeBottomTab === "testcase" && (
                <div className="space-y-3">
                  {/* Case Selector */}
                  <div className="flex items-center gap-2">
                    {(problem.testCases || [])
                      .map((tc: any, i: number) => (
                        <button
                          key={tc.id || i}
                          onClick={() => {
                            setActiveCaseIndex(i);
                            setIsCustomInputActive(false);
                          }}
                          className={`px-3 py-1.5 rounded text-sm transition-colors ${
                            activeCaseIndex === i && !isCustomInputActive
                              ? pageTheme === 'light'
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-white/10 text-white"
                              : pageTheme === 'light'
                                ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                : "text-gray-400 hover:bg-white/5 hover:text-gray-300"
                          }`}
                        >
                          Case {i + 1}
                        </button>
                      ))}
                    <button
                      onClick={() => setIsCustomInputActive(true)}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        isCustomInputActive
                          ? pageTheme === 'light'
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-white/10 text-white"
                          : pageTheme === 'light'
                            ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            : "text-gray-400 hover:bg-white/5 hover:text-gray-300"
                      }`}
                    >
                      Custom Testcase
                    </button>
                  </div>

                  {/* Test Case Content */}
                  {!isCustomInputActive ? (
                    (() => {
                      const samples = (problem.testCases || []);
                      const activeCase = samples[activeCaseIndex];
                      if (!activeCase) return <div className="text-gray-500 text-sm">No sample cases available</div>;
                      
                      return (
                        <div className="space-y-3">
                          <div>
                            <div className={`text-xs mb-2 font-medium ${
                              pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}>Input:</div>
                            <div className={`p-3 rounded border text-sm font-mono whitespace-pre-wrap ${
                              pageTheme === 'light'
                                ? 'bg-gray-50 border-gray-300 text-gray-900'
                                : 'bg-[#2d2d2d] border-white/10 text-gray-200'
                            }`}>
                              {activeCase.input}
                            </div>
                          </div>
                          <div>
                            <div className={`text-xs mb-2 font-medium ${
                              pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}>Output:</div>
                            <div className={`p-3 rounded border text-sm font-mono whitespace-pre-wrap ${
                              pageTheme === 'light'
                                ? 'bg-gray-50 border-gray-300 text-gray-900'
                                : 'bg-[#2d2d2d] border-white/10 text-gray-200'
                            }`}>
                              {activeCase.output}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-3">
                      {/* Input and Output Side by Side */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Input */}
                        <div>
                          <div className={`text-xs mb-2 font-medium ${
                            pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                          }`}>Input:</div>
                          <textarea
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="Enter your test input..."
                            className={`w-full h-[200px] p-3 rounded border text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                              pageTheme === 'light'
                                ? 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                                : 'bg-[#2d2d2d] border-white/10 text-gray-200 placeholder-gray-500'
                            }`}
                          />
                        </div>
                        
                        {/* Expected Output */}
                        <div>
                          <div className={`text-xs mb-2 font-medium ${
                            pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                          }`}>Expected Output:</div>
                          <textarea
                            value={customOutput}
                            onChange={(e) => setCustomOutput(e.target.value)}
                            placeholder="Enter expected output..."
                            className={`w-full h-[200px] p-3 rounded border text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                              pageTheme === 'light'
                                ? 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                                : 'bg-[#2d2d2d] border-white/10 text-gray-200 placeholder-gray-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === TEST RESULT TAB === */}
              {activeBottomTab === "result" && (
                <div className="space-y-4">
                  {!testResults || testResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                      <p className="text-sm">You must run your code first</p>
                    </div>
                  ) : (
                    <>
                      {/* LeetCode-Style Status Header */}
                      <div className={`pb-4 border-b ${
                        pageTheme === 'light' ? 'border-gray-300' : 'border-white/10'
                      }`}>
                        {/* Status and Runtime */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {testResults.every((r: any) => r.passed) ? (
                              <div className={`text-lg font-semibold ${
                                pageTheme === 'light' ? 'text-green-600' : 'text-green-500'
                              }`}>Accepted</div>
                            ) : testResults.some((r: any) => r.stderr || r.error) ? (
                              <div className={`text-lg font-semibold ${
                                pageTheme === 'light' ? 'text-red-600' : 'text-red-500'
                              }`}>Runtime Error</div>
                            ) : (
                              <div className={`text-lg font-semibold ${
                                pageTheme === 'light' ? 'text-red-600' : 'text-red-500'
                              }`}>Wrong Answer</div>
                            )}
                            {testResults.some((r: any) => r.time) && (
                              <div className={`text-sm ${
                                pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                              }`}>
                                Runtime: {Math.max(...testResults.map((r: any) => r.time || 0))} ms
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Compact Case Pills - LeetCode Style */}
                        <div className="flex flex-wrap items-center gap-2">
                          {testResults.map((result: any, i: number) => (
                            <div
                              key={i}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                result.passed
                                  ? pageTheme === 'light'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                  : pageTheme === 'light'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {result.passed ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                              <span>Case {i + 1}</span>
                              {result.isHidden && (
                                <span className="text-xs opacity-70">(Hidden)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detailed Test Results */}
                      <div className="space-y-3">
                        {testResults.map((result: any, i: number) => (
                          <div
                            key={i}
                            className={`p-4 rounded border ${
                              result.passed
                                ? "bg-green-500/5 border-green-500/30"
                                : "bg-red-500/5 border-red-500/30"
                            }`}
                          >
                            {/* Header - with case indicator */}
                            <div className="flex items-center justify-between mb-3">
                              <div className={`flex items-center gap-2 font-semibold ${
                                result.passed 
                                  ? pageTheme === 'light' ? 'text-green-600' : 'text-green-500'
                                  : pageTheme === 'light' ? 'text-red-600' : 'text-red-500'
                              }`}>
                                {result.passed ? (
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Case {i + 1}
                                    {result.isHidden && <span className="text-xs opacity-70 ml-1">(Hidden)</span>}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    Case {i + 1}
                                    {result.isHidden && <span className="text-xs opacity-70 ml-1">(Hidden)</span>}
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs px-2 py-1 rounded font-medium ${
                                result.passed
                                  ? pageTheme === 'light'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-green-500/20 text-green-400'
                                  : pageTheme === 'light'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-red-500/20 text-red-400'
                              }`}>
                                {result.passed ? 'Passed' : 'Failed'}
                              </div>
                              {result.time && (
                                <span className={`text-xs ${
                                  pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                                }`}>Runtime: {result.time}ms</span>
                              )}
                            </div>

                            {/* Input */}
                            <div className="mb-3">
                              <div className={`text-xs mb-1.5 font-medium ${
                                pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                              }`}>Input</div>
                              <div className={`p-2.5 rounded text-xs font-mono whitespace-pre-wrap border ${
                                pageTheme === 'light'
                                  ? 'bg-gray-50 border-gray-300 text-gray-900'
                                  : 'bg-[#2d2d2d] border-white/10 text-gray-200'
                              }`}>
                                {result.input}
                              </div>
                            </div>

                            {/* Output Comparison */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className={`text-xs mb-1.5 font-medium ${
                                  pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                                }`}>Your Output</div>
                                <div className={`p-2.5 rounded text-xs font-mono whitespace-pre-wrap border ${
                                  result.passed 
                                    ? pageTheme === 'light'
                                      ? "bg-gray-50 border-gray-300 text-gray-900"
                                      : "bg-[#2d2d2d] border-white/10 text-gray-200" 
                                    : pageTheme === 'light'
                                      ? "bg-red-50 border-red-300 text-red-700"
                                      : "bg-red-500/10 border-red-500/30 text-red-300"
                                }`}>
                                  {result.stdout || result.actualOutput || "(empty)"}
                                </div>
                              </div>
                              <div>
                                <div className={`text-xs mb-1.5 font-medium ${
                                  pageTheme === 'light' ? 'text-gray-600' : 'text-gray-400'
                                }`}>Expected</div>
                                <div className={`p-2.5 rounded text-xs font-mono whitespace-pre-wrap border ${
                                  pageTheme === 'light'
                                    ? 'bg-gray-50 border-gray-300 text-gray-900'
                                    : 'bg-[#2d2d2d] border-white/10 text-gray-200'
                                }`}>
                                  {result.expectedOutput || result.expected || "(empty)"}
                                </div>
                              </div>
                            </div>

                            {/* Error Message */}
                            {result.stderr && (
                              <div className="mt-3">
                                <div className="text-red-400 text-xs mb-1.5 font-medium">Error</div>
                                <div className="bg-red-500/10 text-red-300 p-2.5 rounded text-xs font-mono whitespace-pre-wrap border border-red-500/30">
                                  {result.stderr}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
      <KeyboardShortcutsDialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen} />
    </div>
  );
};

export default ProblemDetailPage;
