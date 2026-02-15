import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  MemoryStick,
  Play,
  Send,
  GripVertical,
  GripHorizontal
} from "lucide-react";
import DifficultyBadge from "@/components/DifficultyBadge";
import { getProblemById, runCode, submitCode, getLanguages, addBookmark, removeBookmark, getMySubmissions } from "@/lib/api";
import type { Problem, Language, RunResult } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Map backend language values to Monaco editor language IDs
const MONACO_LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript",
  python: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  scala: "scala",
  csharp: "csharp",
  typescript: "typescript",
};

// Backend-supported Judge0 language IDs (matches exactly with backend Judge0Service LANGUAGE_IDS)
const BACKEND_SUPPORTED_JUDGE0_IDS: Record<number, string> = {
  71: "python",      // Python 3.8.1
  62: "java",        // Java (OpenJDK 13.0.1)
  54: "cpp",         // C++ (GCC 9.2.0)
  50: "c",           // C (GCC 9.2.0)
  63: "javascript",  // JavaScript (Node.js 12.14.0)
  74: "typescript",  // TypeScript (3.7.4)
  60: "go",          // Go (1.13.5)
  73: "rust",        // Rust (1.40.0)
  72: "ruby",        // Ruby (2.7.0)
  56: "php",         // PHP (7.4.1)
  83: "swift",       // Swift (5.2.3)
  78: "kotlin",      // Kotlin (1.3.70)
  81: "scala",       // Scala (2.13.2)
  51: "csharp",      // C# (Mono 6.6.0.161)
};

// Normalize a language entry from Judge0 API
function normalizeLanguage(raw: any): Language | null {
  if (!raw || typeof raw !== 'object') return null;
  
  const judge0Id = Number(raw.id);
  const judge0Name = raw.name || '';
  
  const backendKey = BACKEND_SUPPORTED_JUDGE0_IDS[judge0Id];
  if (!backendKey) return null;
  
  const displayName = judge0Name.replace(/\s*\([^)]*\)/, '').trim();
  
  return {
    id: String(judge0Id),
    name: displayName,
    value: backendKey,
    version: '',
    isActive: true,
  };
}

const ProblemDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("description");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<string>("");
  const [output, setOutput] = useState<null | {
    type: "run" | "submit";
    results: RunResult[];
    status?: string;
    passedCount?: number;
  }>(null);
  const editorRef = useRef<any>(null);

  // Fetch problem details
  const { data: problem, isLoading: problemLoading } = useQuery<Problem>({
    queryKey: ["problem", id],
    queryFn: () => getProblemById(id!),
    enabled: !!id,
  });

  // Fetch languages
  const { data: languagesData } = useQuery({
    queryKey: ["languages"],
    queryFn: getLanguages,
  });

  // Fetch submissions for this problem
  const { data: submissionsData } = useQuery({
    queryKey: ["submissions", id],
    queryFn: () => getMySubmissions({ problemId: id }),
    enabled: !!id,
  });

  const rawLangs = (() => {
    if (!languagesData) return [];
    if (Array.isArray(languagesData)) return languagesData;
    const nested = languagesData?.data?.languages || languagesData?.languages
      || languagesData?.data || languagesData?.items;
    if (Array.isArray(nested)) return nested;
    return [];
  })();

  const languages: Language[] = rawLangs
    .map(normalizeLanguage)
    .filter((lang): lang is Language => lang !== null && lang.isActive);

  const submissions = Array.isArray(submissionsData) ? submissionsData :
    (submissionsData?.submissions || submissionsData?.items || []);

  // Set default language
  useEffect(() => {
    if (languages.length > 0 && !language) {
      const preferred = languages.find(l => l.value === 'javascript')
        || languages.find(l => l.value === 'python')
        || languages[0];
      setLanguage(preferred.value);
    }
  }, [languages, language]);

  // Set starter code
  useEffect(() => {
    if (problem?.starterCode) {
      setCode(problem.starterCode);
    }
  }, [problem?.starterCode]);

  // Run code mutation
  const runMutation = useMutation({
    mutationFn: () => runCode(id!, code, language),
    onSuccess: (data) => {
      const resultData = data;
      if (!resultData) {
        toast.error("Invalid response from server");
        return;
      }

      const testResults = (resultData.testResults || []).map((tr: any) => ({
        ...tr,
        executionTime: tr.time,
        memoryUsed: tr.memory,
        error: tr.stderr || tr.compileOutput || (tr.passed ? undefined : tr.status),
      }));
      const passedCount = resultData.passedCount || 0;
      const totalCount = resultData.totalCount || 0;
      const status = resultData.status || 'UNKNOWN';

      setOutput({
        type: "run",
        results: testResults,
        passedCount,
        status
      });

      if (status === 'ACCEPTED' || passedCount === totalCount && totalCount > 0) {
        toast.success(`All ${totalCount} test cases passed!`);
      } else {
        toast.error(`${passedCount}/${totalCount} test cases passed`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to run code");
    },
  });

  // Submit code mutation
  const submitMutation = useMutation({
    mutationFn: () => submitCode(id!, code, language),
    onSuccess: (data) => {
      const resultData = data;
      if (!resultData) {
        toast.error("Invalid response from server");
        return;
      }

      const testResults = (resultData.testResults || []).map((tr: any) => ({
        ...tr,
        testCaseIndex: (tr.testCase || tr.testCaseIndex || 1) - 1,
        executionTime: tr.time,
        memoryUsed: tr.memory,
        error: tr.stderr || tr.compileOutput || (tr.passed ? undefined : tr.status),
      }));
      const passedCount = resultData.passedTestCases || 0;
      const totalCount = resultData.totalTestCases || 0;
      const status = resultData.status || 'UNKNOWN';

      setOutput({
        type: "submit",
        results: testResults,
        status,
        passedCount
      });

      queryClient.invalidateQueries({ queryKey: ["submissions", id] });
      queryClient.invalidateQueries({ queryKey: ["problem", id] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });

      if (status === "ACCEPTED") {
        toast.success("Accepted! All test cases passed 🎉", { duration: 4000 });
      } else {
        toast.error(`${status.replace(/_/g, " ")} - ${passedCount}/${totalCount} passed`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit code");
    },
  });

  // Bookmark mutations
  const bookmarkMutation = useMutation({
    mutationFn: (isBookmarked: boolean) =>
      isBookmarked ? removeBookmark(id!) : addBookmark(id!),
    onSuccess: (_, isBookmarked) => {
      queryClient.invalidateQueries({ queryKey: ["problem", id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(isBookmarked ? "Bookmark removed" : "Problem bookmarked");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update bookmark");
    },
  });

  const handleRun = () => {
    runMutation.mutate();
  };

  const handleSubmit = () => {
    submitMutation.mutate();
  };

  const handleBookmark = () => {
    bookmarkMutation.mutate(!!(problem as any)?.isBookmarked);
  };

  if (problemLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Problem not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            to="/problems"
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-accent rounded-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <h1 className="font-semibold text-sm leading-tight">{problem.title}</h1>
          </div>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {problem.timeLimit}ms
            </span>
            <span className="flex items-center gap-1.5">
              <MemoryStick className="w-3.5 h-3.5" />
              {problem.memoryLimit}MB
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBookmark}
            disabled={bookmarkMutation.isPending}
            className="h-8"
          >
            {(problem as any)?.isBookmarked ? (
              <>
                <BookmarkCheck className="w-4 h-4 mr-1.5 text-primary" />
                <span className="text-xs">Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 mr-1.5" />
                <span className="text-xs">Save</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Panel: Problem Description */}
          <Panel defaultSize={40} minSize={25} className="flex flex-col bg-background">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b border-border px-5 pt-3 bg-card/50 sticky top-0 z-10 backdrop-blur-sm">
                <TabsList className="h-9 bg-muted/50">
                  <TabsTrigger value="description" className="text-xs">Description</TabsTrigger>
                  <TabsTrigger value="submissions" className="text-xs">
                    Submissions
                    {submissions.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
                        {submissions.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="description" className="p-5 space-y-5 m-0 pb-10">
                  {/* Tags */}
                  {problem.tags && problem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {problem.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:scale-105"
                          style={{
                            backgroundColor: tag.color + "15",
                            color: tag.color,
                            border: `1px solid ${tag.color}30`
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {problem.description}
                    </div>
                  </div>

                  {/* Example */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Example:</h3>
                    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <div className="p-4">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Input</div>
                          <pre className="text-xs font-mono text-foreground overflow-x-auto">{problem.sampleInput}</pre>
                        </div>
                        <div className="p-4">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Output</div>
                          <pre className="text-xs font-mono text-foreground overflow-x-auto">{problem.sampleOutput}</pre>
                        </div>
                      </div>
                      {problem.explanation && (
                        <div className="px-4 py-3 border-t border-border bg-muted/50">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5">Explanation</div>
                          <p className="text-xs text-foreground/80 leading-relaxed">{problem.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Constraints */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Constraints:</h3>
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {problem.constraints}
                      </pre>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="submissions" className="p-5 m-0 pb-10">
                  {submissions && submissions.length > 0 ? (
                    <div className="space-y-2">
                      {submissions.slice(0, 20).map((submission: any) => {
                        const runTime = submission.runtime ?? submission.executionTime ?? submission.time;
                        const memory = submission.memoryUsed ?? submission.memory;
                        const dateVal = submission.submittedAt || submission.createdAt;

                        return (
                        <div
                          key={submission.id}
                          className="rounded-lg border border-border bg-card p-3.5 hover:bg-accent/50 transition-all cursor-pointer group"
                          onClick={() => {
                            setCode(submission.code);
                            setLanguage(submission.language);
                            toast.info("Loaded submission code into editor");
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "text-xs font-semibold px-2 py-1 rounded-md",
                              submission.status === 'ACCEPTED'
                                ? 'bg-success/10 text-success'
                                : 'bg-destructive/10 text-destructive'
                            )}>
                              {submission.status === 'ACCEPTED' ? (
                                <><CheckCircle2 className="w-3 h-3 inline mr-1" />Accepted</>
                              ) : (
                                <><XCircle className="w-3 h-3 inline mr-1" />{submission.status}</>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {dateVal && !isNaN(new Date(dateVal).getTime()) 
                                ? new Date(dateVal).toLocaleString() 
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="capitalize">{submission.language}</span>
                            {runTime !== undefined && runTime !== null && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {runTime}ms
                              </span>
                            )}
                            {memory !== undefined && memory !== null && (
                              <span className="flex items-center gap-1">
                                <MemoryStick className="w-3 h-3" />
                                {memory}KB
                              </span>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Send className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No submissions yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Submit your solution to see results here</p>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </Panel>

          <PanelResizeHandle className="w-1.5 flex items-center justify-center bg-border/40 hover:bg-primary/20 transition-colors cursor-col-resize group z-50">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </PanelResizeHandle>

          <Panel defaultSize={60} minSize={25}>
            <PanelGroup direction="vertical">
              {/* Top Half: Code Editor */}
              <Panel defaultSize={60} minSize={10} className="flex flex-col min-h-0 bg-[#1e1e1e]">
                {/* Editor Toolbar */}
                <div className="flex items-center justify-between px-4 h-10 bg-[#1e1e1e] border-b border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-green-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Code
                    </span>
                    <div className="w-px h-3.5 bg-white/10 mx-1" />
                    <Select value={String(language)} onValueChange={setLanguage}>
                      <SelectTrigger className="w-auto h-6 text-xs bg-transparent border-none text-muted-foreground hover:text-foreground focus:ring-0 p-0 gap-1.5">
                        <SelectValue placeholder="Select Language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((l: any) => (
                          <SelectItem key={String(l.value || l.id || l)} value={String(l.value || l.id || l)} className="text-xs">
                            {l.label || l.name || l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleRun} 
                      disabled={!language || runMutation.isPending || submitMutation.isPending}
                      variant="secondary"
                      className="h-7 text-xs bg-white hover:bg-[#4e4e4e] text-foreground border-transparent gap-1.5"
                    >
                      {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                      Run
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSubmit} 
                      disabled={!language || runMutation.isPending || submitMutation.isPending}
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent gap-1.5"
                    >
                      {submitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Submit
                    </Button>
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 relative min-h-0">
                  <Editor
                    height="100%"
                    language={MONACO_LANGUAGE_MAP[language] || language}
                    value={code}
                    onChange={(v) => setCode(v || "")}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
                      fontLigatures: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      padding: { top: 10, bottom: 10 },
                      lineNumbers: "on",
                      renderLineHighlight: "all",
                      automaticLayout: true,
                      tabSize: 2,
                      insertSpaces: true,
                      wordWrap: "on",
                      wrappingIndent: "indent",
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                      bracketPairColorization: { enabled: true },
                      formatOnPaste: true,
                      formatOnType: true,
                      suggestOnTriggerCharacters: true,
                      acceptSuggestionOnEnter: "on",
                      quickSuggestions: true,
                    }}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="h-1.5 flex items-center justify-center bg-[#1e1e1e] border-t border-b border-white/5 hover:bg-white/5 transition-colors cursor-row-resize group z-50">
                <GripHorizontal className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </PanelResizeHandle>

              {/* Bottom Half: Testcase / Result */}
              <Panel defaultSize={40} minSize={10} className="flex flex-col bg-[#1e1e1e]">
                {/* Action Bar */}
                <div className="flex items-center justify-between px-4 h-9 bg-[#1e1e1e] border-b border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-4 h-full">
                    <button 
                      className={cn(
                        "flex items-center gap-2 text-xs font-medium transition-colors h-full border-b-[1.5px] px-1",
                        !output ? "text-white" : "text-muted-foreground border-transparent hover:text-foreground"
                      )}
                      onClick={() => setOutput(null)}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded flex items-center justify-center ",
                        !output ? "text-white" : ""
                      )}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      Testcase
                    </button>
<button 
  className={cn(
    "flex items-center gap-2 text-xs font-medium transition-colors h-full border-b-[1.5px] px-1",
    output 
      ? "text-white border-white" 
      : "text-muted-foreground border-transparent hover:text-foreground"
  )}
  onClick={() => !output && toast.info("Run code to see results")}
>
  <div className={cn(
    "w-3.5 h-3.5 rounded flex items-center justify-center",
    output ? "text-white" : "bg-muted/50 text-muted-foreground"
  )}>
    <span className="text-[10px] leading-none font-bold">›_</span>
  </div>
  Test Result
</button>

                  </div>
                </div>

                {/* Console Content */}
                <div className="flex-1 overflow-hidden relative">
                  {!output ? (
                    // Testcase View - Monaco Editor
                    <div className="h-full w-full">
                      <Editor
                        height="100%"
                        language="plaintext"
                        value={problem.testCases?.filter((tc: any) => tc.isSample).map((tc: any) => tc.input).join('\n') || ""}
                        theme="vs-dark"
                        options={{
                          fontSize: 14,
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          lineNumbers: "on",
                          renderLineHighlight: "none", // Cleaner look for test cases
                          automaticLayout: true,
                          readOnly: true, // Initially read-only for display
                          padding: { top: 10, bottom: 10 },
                          cursorStyle: "line",
                          hideCursorInOverviewRuler: true,
                        }}
                      />
                    </div>
                  ) : (
                    // Test Result View
                    <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                           <h3 className={cn(
                            "text-lg font-semibold",
                            output.status === 'ACCEPTED' || output.status === 'PASSED' ? "text-green-500" : "text-red-500"
                          )}>
                            {output.status === 'ACCEPTED' ? 'Accepted' : (output.status || 'Wrong Answer')}
                          </h3>
                          <span className="text-xs text-muted-foreground mt-1">
                            Runtime: {output.results[0]?.executionTime || '0'}ms
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                          {output.results.map((r, i) => (
                            <button
                              key={i}
                              className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors border",
                                r.passed 
                                  ? "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20" 
                                  : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
                              )}
                            >
                              <div className={cn("w-1.5 h-1.5 rounded-full", r.passed ? "bg-green-500" : "bg-red-500")} />
                              Case {i + 1}
                            </button>
                          ))}
                        </div>

                        {output.results.map((r, i) => (
                          <div key={i} className="space-y-3">
                            {r.error ? (
                              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs text-red-400 font-mono whitespace-pre-wrap">
                                {r.error}
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 gap-1">
                                   <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Input</div>
                                   <div className="bg-[#2d2d2d] p-2.5 rounded text-xs font-mono text-foreground/90 whitespace-pre-wrap">
                                    {r.input || "Hidden"}
                                   </div>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                   <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Output</div>
                                   <div className={cn(
                                     "p-2.5 rounded text-xs font-mono text-foreground/90 whitespace-pre-wrap",
                                     r.passed ? "bg-[#2d2d2d]" : "bg-red-500/10 border border-red-500/20"
                                   )}>
                                    {r.actualOutput}
                                   </div>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                   <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Expected</div>
                                   <div className="bg-[#2d2d2d] p-2.5 rounded text-xs font-mono text-foreground/90 whitespace-pre-wrap">
                                    {r.expectedOutput}
                                   </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))[0]} 
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

export default ProblemDetailPage;
