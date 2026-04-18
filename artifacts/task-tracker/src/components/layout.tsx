import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ClipboardList, LayoutDashboard, ListFilter, Settings2, Shield, ShieldOff, Lock } from "lucide-react";
import { ReactNode, useState } from "react";
import { useAdmin } from "@/context/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const userNavigation = [
  { name: "Submit Task", href: "/", icon: ClipboardList },
];

const adminNavigation = [
  { name: "Submit Task", href: "/", icon: ClipboardList },
  { name: "All Submissions", href: "/submissions", icon: ListFilter },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Manage Dropdowns", href: "/dropdowns", icon: Settings2 },
];

function AdminLoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const success = login(pin);
    if (success) {
      setPin("");
      setError("");
      onClose();
    } else {
      setError("Incorrect PIN. Please try again.");
    }
  }

  function handleClose() {
    setPin("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-primary" />
            <DialogTitle>Admin Access</DialogTitle>
          </div>
          <DialogDescription>
            Enter the admin PIN to access reports and management features.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!pin}>
              Sign In
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAdmin, logout } = useAdmin();
  const [showLogin, setShowLogin] = useState(false);

  const navigation = isAdmin ? adminNavigation : userNavigation;
  const currentPage = navigation.find((n) => n.href === location)?.name ?? "Task Tracker";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="border-b border-border p-0">
            <div className="flex flex-col px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold tracking-wider">
                  LL
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-foreground">Labour Laws India</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Associates Pvt. Ltd.</p>
                </div>
              </div>
              <div className="mt-3 px-1 py-1.5 bg-muted/60 rounded-md">
                <p className="text-[10px] text-center font-semibold uppercase tracking-widest text-muted-foreground">
                  Task & Compliance Tracker
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-3 mb-1">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href}
                        tooltip={item.name}
                        className="rounded-lg h-9 px-3 font-medium text-sm"
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4 space-y-3">
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={logout}
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Exit Admin Mode
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-xs text-muted-foreground"
                onClick={() => setShowLogin(true)}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Login
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              &copy; {new Date().getFullYear()} LLIA Pvt. Ltd.<br />
              All rights reserved.
            </p>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <header className="h-13 border-b border-border flex items-center gap-3 px-5 shrink-0 bg-background sticky top-0 z-10">
            <SidebarTrigger className="-ml-1 text-muted-foreground" />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">{currentPage}</span>
            {isAdmin && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                <Shield className="h-3 w-3" />
                Admin
              </span>
            )}
          </header>
          <div className="flex-1 overflow-auto p-5 md:p-7 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <AdminLoginDialog open={showLogin} onClose={() => setShowLogin(false)} />
    </SidebarProvider>
  );
}
