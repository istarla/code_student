import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DifficultyBadge from "@/components/DifficultyBadge";
import { getBookmarks, removeBookmark } from "@/lib/api";
import { useProblems } from "@/hooks/useApi"; // Import useProblems
import type { Bookmark as BookmarkType } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BookmarksPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: getBookmarks,
  });

  console.log('Bookmarks Data:', data);

  // Backend returns: { bookmarks: [...], pagination: {...} }
  const bookmarks: BookmarkType[] = Array.isArray(data) ? data : 
    (data?.bookmarks || []);

  const deleteMutation = useMutation({
    mutationFn: (problemId: string) => removeBookmark(problemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("Bookmark removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove bookmark");
    },
  });

  const { data: problemsData } = useProblems();
  const allProblems = Array.isArray(problemsData) ? problemsData : (problemsData?.problems || []);

  // Map status from problems to bookmarks
  const bookmarksWithStatus = bookmarks.map((b) => {
    const problem = allProblems.find((p: any) => p.id === b.id);
    return { ...b, status: problem?.status || 'UNSOLVED' };
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Bookmark className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Bookmarks</h1>
      </div>

      {bookmarksWithStatus.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No bookmarks yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3 w-[120px]">Difficulty</th>
                <th className="px-4 py-3 w-[120px]">Status</th>
                <th className="px-4 py-3 w-[80px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookmarksWithStatus.map((b: any) => (
                <tr key={b.id} className="group hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/problems/${b.id}`} className="font-medium hover:text-primary transition-colors block">
                      {b.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {b.module && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {b.module.name || "Module " + b.module.order}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {b.tags && b.tags.length > 0 ? b.tags.map((t: any) => t.name).join(', ') : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DifficultyBadge difficulty={b.difficulty} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md inline-flex items-center gap-1.5",
                      b.status === 'SOLVED' ? "bg-green-500/10 text-green-500" :
                      b.status === 'ATTEMPTED' ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                         b.status === 'SOLVED' ? "bg-green-500" :
                         b.status === 'ATTEMPTED' ? "bg-yellow-500" :
                         "bg-muted-foreground"
                      )} />
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => deleteMutation.mutate(b.id)}
                      disabled={deleteMutation.isPending}
                      title="Remove Bookmark"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
