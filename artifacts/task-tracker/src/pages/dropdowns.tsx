import { useState } from "react";
import {
  useGetDropdowns,
  useAddDropdownOption,
  useDeleteDropdownOption,
  getGetDropdownsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DropdownCategory = "payroll" | "company" | "work" | "pending" | "officer" | "assigned";

const CATEGORIES: { key: DropdownCategory; label: string; description: string }[] = [
  { key: "payroll", label: "Payroll Master Name", description: "Names of payroll entities" },
  { key: "company", label: "CO CODE / Company Name", description: "Company codes and names" },
  { key: "work", label: "Work To Be Done", description: "Types of compliance work" },
  { key: "pending", label: "Pending / Done Status", description: "Task status options" },
  { key: "officer", label: "Field Officer Name", description: "Field officers available" },
  { key: "assigned", label: "Person Who Assigned Work", description: "Assigning persons / roles" },
];

function CategoryCard({
  category,
  label,
  description,
  options,
}: {
  category: DropdownCategory;
  label: string;
  description: string;
  options: string[];
}) {
  const [newValue, setNewValue] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addOption = useAddDropdownOption();
  const deleteOption = useDeleteDropdownOption();

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) {
      toast({ title: "Already exists", description: `"${trimmed}" is already in this list.`, variant: "destructive" });
      return;
    }
    addOption.mutate(
      { category, data: { value: trimmed } },
      {
        onSuccess: () => {
          setNewValue("");
          queryClient.invalidateQueries({ queryKey: getGetDropdownsQueryKey() });
          toast({ title: "Option added", description: `"${trimmed}" has been added to ${label}.` });
        },
        onError: () => {
          toast({ title: "Failed to add", description: "Could not add the option. Try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (value: string) => {
    deleteOption.mutate(
      { category, data: { value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDropdownsQueryKey() });
          toast({ title: "Option removed", description: `"${value}" has been removed.` });
        },
        onError: () => {
          toast({ title: "Failed to remove", description: "Could not remove the option.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {options.length} item{options.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder={`Add new ${label.toLowerCase()}...`}
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="h-9 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newValue.trim() || addOption.isPending}
            className="h-9 gap-1.5 px-3 shrink-0"
          >
            {addOption.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
            Add
          </Button>
        </div>

        {/* Options list */}
        <div className="flex flex-wrap gap-2 min-h-[36px]">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No options yet. Add one above.</p>
          ) : (
            options.map(opt => (
              <AlertDialog key={opt}>
                <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-md px-2.5 py-1 text-sm">
                  <span className="text-foreground">{opt}</span>
                  <AlertDialogTrigger asChild>
                    <button className="ml-1.5 text-muted-foreground/60 hover:text-destructive transition-colors rounded-full">
                      <X className="h-3 w-3" />
                    </button>
                  </AlertDialogTrigger>
                </div>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this option?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove <strong>"{opt}"</strong> from the <strong>{label}</strong> dropdown. Existing submissions will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(opt)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DropdownsPage() {
  const { data: dropdowns, isLoading } = useGetDropdowns({
    query: { queryKey: getGetDropdownsQueryKey() },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Dropdowns</h1>
        <p className="text-muted-foreground mt-1">
          Add or remove options from the form dropdowns. Changes take effect immediately across the form.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading dropdown data...</span>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.key}
              category={cat.key}
              label={cat.label}
              description={cat.description}
              options={dropdowns?.[cat.key as keyof typeof dropdowns] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
