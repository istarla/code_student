import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Target, TrendingUp, Award, Code2, Loader2 } from "lucide-react";
import { getMyProgress, getProblems } from "@/lib/api";
import type { Progress } from "@/lib/api";

const ProgressPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["progress"],
    queryFn: getMyProgress,
  });

  // Backend returns: { solved, attempted, total, unsolved, solvedByDifficulty }
  const progress = data as Progress | undefined;

  // Fetch all problems to calculate totals per difficulty
  const { data: problemsData } = useQuery({
    queryKey: ["problems"],
    queryFn: () => getProblems(),
  });

  const allProblems = Array.isArray(problemsData) ? problemsData : (problemsData as any)?.problems || [];

  // Calculate totals per difficulty from all problems
  const totalEasy = allProblems.filter((p: any) => p.difficulty === "EASY").length;
  const totalMedium = allProblems.filter((p: any) => p.difficulty === "MEDIUM").length;
  const totalHard = allProblems.filter((p: any) => p.difficulty === "HARD").length;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">My Progress</h1>
        <div className="glass-card rounded-xl p-12 text-center text-destructive">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Failed to load progress data</p>
          <p className="text-sm mt-2 text-muted-foreground">
            {error instanceof Error ? error.message : 'Please try again later'}
          </p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">My Progress</h1>
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No progress data available</p>
          <p className="text-sm mt-2">Start solving problems to track your progress!</p>
        </div>
      </div>
    );
  }

  // Calculate Acceptance Rate
  const totalSubmissions = progress.solved + progress.attempted; // Approximate if not provided
  // Or better: Solved / (Solved + Failed) but we only have solved/attempted/unsolved counts.
  // User asked for "Acceptance Rate", usually Solved / Total Submissions.
  // If "Attempted" means "Tried but not solved", then Total Submissions >= Solved + Attempted.
  // Let's use (Solved / (Solved + Attempted)) as a proxy for personal acceptance rate.
  const acceptanceRate = totalSubmissions > 0 
    ? Math.round((progress.solved / totalSubmissions) * 100) 
    : 0;

  // Calculate derived stats from backend data
  const stats = [
    { label: "Problems Solved", value: progress.solved, icon: CheckCircle2, color: "text-success" },
    { label: "Acceptance Rate", value: `${acceptanceRate}%`, icon: Award, color: "text-blue-500" },
    { label: "Attempted", value: progress.attempted, icon: Code2, color: "text-secondary" },
    { label: "Total Problems", value: progress.total, icon: TrendingUp, color: "text-primary" },
  ];

  // Convert solvedByDifficulty array to object for easier access
  const difficultyMap = progress.solvedByDifficulty.reduce((acc, item) => {
    acc[item.difficulty] = item.count;
    return acc;
  }, {} as Record<string, number>);

  const difficultyBreakdown = [
    { 
      label: "Easy", 
      solved: difficultyMap['EASY'] || 0, 
      total: totalEasy || progress.total, // Fallback to global total if 0 (shouldn't happen if problems loaded)
      color: "bg-success" 
    },
    { 
      label: "Medium", 
      solved: difficultyMap['MEDIUM'] || 0, 
      total: totalMedium || progress.total, 
      color: "bg-warning" 
    },
    { 
      label: "Hard", 
      solved: difficultyMap['HARD'] || 0, 
      total: totalHard || progress.total, 
      color: "bg-destructive" 
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Progress</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-5 hover-lift scroll-reveal" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <Award className="w-4 h-4 text-muted-foreground/30" />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Difficulty Breakdown */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="font-semibold mb-4">Difficulty Breakdown</h2>
        <div className="space-y-4">
          {difficultyBreakdown.map((d) => (
            <div key={d.label}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span>{d.label}</span>
                <span className="text-muted-foreground">
                  {d.solved} / {d.total} solved
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.color} transition-all duration-700`}
                  style={{ width: `${d.total > 0 ? (d.solved / d.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressPage;
