import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetDropdowns,
  useCreateSubmission,
  getGetDropdownsQueryKey,
  getListSubmissionsQueryKey,
  getGetSubmissionSummaryQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/combobox";
import { Loader2, CheckCircle2, ClipboardList } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  payroll: z.string().min(1, "Payroll Master Name is required"),
  company: z.string().min(1, "Company Name is required"),
  work: z.string().min(1, "Work to be done is required"),
  detail1: z.string().min(1, "Detail is required"),
  detail2: z.string().optional(),
  pending: z.string().min(1, "Pending Done status is required"),
  remarks: z.string().optional(),
  officer: z.string().optional(),
  assigned: z.string().optional(),
}).superRefine((data, ctx) => {
  const isDone = data.pending.toLowerCase() === "done";
  if (!isDone && data.pending !== "" && !data.remarks?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Remarks are required when task is not Done",
      path: ["remarks"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const { data: dropdowns, isLoading: dropdownsLoading } = useGetDropdowns({
    query: { queryKey: getGetDropdownsQueryKey() },
  });

  const createSubmission = useCreateSubmission();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payroll: "",
      company: "",
      work: "",
      detail1: "",
      detail2: "",
      pending: "",
      remarks: "",
      officer: "",
      assigned: "",
    },
  });

  const pendingValue = useWatch({ control: form.control, name: "pending" });
  const remarksRequired = pendingValue !== "" && pendingValue.toLowerCase() !== "done";

  function onSubmit(values: FormValues) {
    createSubmission.mutate(
      {
        data: {
          payroll: values.payroll,
          company: values.company,
          work: values.work,
          detail1: values.detail1,
          detail2: values.detail2 || null,
          pending: values.pending,
          remarks: values.remarks || null,
          officer: values.officer || null,
          assigned: values.assigned || null,
        },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSubmissionSummaryQueryKey() });
        },
        onError: (error) => {
          toast({
            title: "Submission Failed",
            description: error.message || "An unexpected error occurred. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleNewEntry() {
    form.reset();
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-200">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Task Recorded Successfully</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The compliance task has been saved to the database.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button onClick={handleNewEntry} className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Submit Another Task
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-0">
      {/* Company Header Banner */}
      <div className="rounded-t-xl bg-primary text-primary-foreground px-8 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Labour Laws India Associates Pvt. Ltd.</p>
        <h1 className="text-2xl font-bold tracking-tight">Task & Compliance Entry Form</h1>
        <p className="text-sm opacity-75 mt-1">Record a new compliance task or work assignment — all starred fields are required</p>
      </div>

      <Card className="rounded-t-none border-t-0 shadow-md">
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              {/* Section 1: Organisation */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">Organisation</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="payroll"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-semibold">Payroll Master Name <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(Actual Doer)</span></FormLabel>
                        <FormControl>
                          <Combobox
                            options={dropdowns?.payroll || []}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select payroll master..."
                            isLoading={dropdownsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-semibold">CO CODE / Name of Company <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Combobox
                            options={dropdowns?.company || []}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select company..."
                            isLoading={dropdownsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section 2: Task Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">Task Details</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <FormField
                  control={form.control}
                  name="work"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-semibold">Work To Be Done <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Combobox
                          options={dropdowns?.work || []}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select type of work..."
                          isLoading={dropdownsLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="detail1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Detail <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter task details..."
                            className="resize-none min-h-[110px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="detail2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-muted-foreground">Additional Detail</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter additional details (optional)..."
                            className="resize-none min-h-[110px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section 3: Status & Remarks */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">Status & Remarks</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="pending"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-semibold">Pending / Done <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Combobox
                            options={dropdowns?.pending || []}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select status..."
                            isLoading={dropdownsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">
                          Remarks{" "}
                          {remarksRequired ? (
                            <span className="text-destructive">*</span>
                          ) : (
                            <span className="text-xs font-normal text-muted-foreground">(optional if Done)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={remarksRequired ? "Required — explain why the task is pending…" : "Enter remarks (optional)…"}
                            className={`resize-none min-h-[80px] ${remarksRequired ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                            {...field}
                          />
                        </FormControl>
                        {remarksRequired && (
                          <p className="text-[11px] text-amber-600 font-medium mt-1">
                            Remarks are mandatory when status is not Done.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section 4: Assignment */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">Assignment</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="officer"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-semibold text-muted-foreground">Field Officer Name</FormLabel>
                        <FormControl>
                          <Combobox
                            options={dropdowns?.officer || []}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Select field officer..."
                            isLoading={dropdownsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assigned"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-semibold text-muted-foreground">Person Who Assigned Work</FormLabel>
                        <FormControl>
                          <Combobox
                            options={dropdowns?.assigned || []}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Select assigning person..."
                            isLoading={dropdownsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2 border-t flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  <span className="text-destructive font-semibold">*</span> Required fields must be filled before submitting.
                </p>
                <Button
                  type="submit"
                  size="lg"
                  className="px-10 font-semibold"
                  disabled={createSubmission.isPending}
                >
                  {createSubmission.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {createSubmission.isPending ? "Submitting..." : "Submit Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
