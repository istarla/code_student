import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  {
    category: "Code Execution",
    items: [
      { keys: ["Ctrl", "Enter"], description: "Run code" },
      { keys: ["Ctrl", "Shift", "Enter"], description: "Submit solution" },
    ],
  },
  {
    category: "Editor",
    items: [
      { keys: ["Ctrl", "Shift", "F"], description: "Format code" },
      { keys: ["Ctrl", "R"], description: "Reset code to boilerplate" },
      { keys: ["Esc"], description: "Exit fullscreen mode" },
    ],
  },
  {
    category: "Navigation",
    items: [
      { keys: ["Ctrl", "/"], description: "Toggle shortcuts panel" },
      { keys: ["F11"], description: "Toggle fullscreen mode" },
    ],
  },
];

export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <>
                          <kbd
                            key={keyIdx}
                            className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded shadow-sm"
                          >
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">
                              +
                            </span>
                          )}
                        </>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">/</kbd> to toggle this panel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
