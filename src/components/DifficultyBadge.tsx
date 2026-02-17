import { cn } from "@/lib/utils";

interface DifficultyBadgeProps {
  difficulty: "EASY" | "MEDIUM" | "HARD";
  className?: string;
}

const DifficultyBadge = ({ difficulty, className }: DifficultyBadgeProps) => {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border";
  /* Updated to Green/Orange/Red scheme */
  const variants = {
    EASY: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    MEDIUM: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    HARD: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };

  return (
    <span className={cn(base, variants[difficulty], className)}>
      {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
    </span>
  );
};

export default DifficultyBadge;
