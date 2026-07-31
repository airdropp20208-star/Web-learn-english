"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User as UserIcon, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-xs">L</AvatarFallback>
          </Avatar>
          <span className="text-sm hidden sm:inline max-w-[120px] truncate">
            Local User
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Local User</span>
            <span className="text-xs text-muted-foreground">
              Data stored in browser
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => {
            if (confirm("Delete all your data? This cannot be undone.")) {
              const keys = Object.keys(localStorage).filter((k) =>
                [
                  "texts:",
                  "vocab:",
                  "memory:",
                  "quizzes:",
                  "progress:",
                  "shadows:",
                ].some((prefix) => k.startsWith(prefix))
              );
              keys.forEach((k) => localStorage.removeItem(k));
              toast.success("All data cleared");
              window.location.reload();
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear all data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
