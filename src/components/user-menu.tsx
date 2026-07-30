"use client";

import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";

interface UserMenuProps {
  /** Tab to redirect to after sign-in (for smart redirect) */
  onSignedOutClick?: (targetTab?: string) => void;
  targetTab?: string;
}

export function UserMenu({ onSignedOutClick, targetTab }: UserMenuProps) {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <Button
        size="sm"
        onClick={() => onSignedOutClick?.(targetTab)}
        className="gap-1.5"
      >
        <UserIcon className="w-4 h-4" />
        Sign in
      </Button>
    );
  }

  const user = session.user as {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };

  const displayName = user.name ?? user.username ?? user.email ?? "User";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors">
          <Avatar className="w-7 h-7">
            <AvatarImage src={user.image ?? undefined} alt={displayName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm hidden sm:inline max-w-[120px] truncate">
            {displayName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
