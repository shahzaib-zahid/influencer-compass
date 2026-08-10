import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Radar, Search, Settings, ShieldAlert, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Discovery", icon: Search },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
  sidebar,
  email,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  email?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3.5">
          <Radar className="size-4 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">InfluencerScope</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-sidebar-border">{sidebar}</div>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface p-2.5">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Scraped data must be used in line with each platform&apos;s terms of service and the
              data-privacy law in your jurisdiction.
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[11px] text-muted-foreground">{email ?? ""}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-7 px-2">
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}