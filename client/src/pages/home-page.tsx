import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Moon,
  Sun,
  Search,
  Plus,
  LogOut,
  Upload,
  Download,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertCredentialSchema,
  type Credential,
  ACCOUNT_TYPES,
  STATUS_TYPES,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { CredentialHealth } from "@/components/credential-health";
import { UserProfile } from "@/components/user-profile";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>(
    [],
  );
  const [editingCredential, setEditingCredential] = useState<Credential | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState<number | null>(null);
  const [selectedCredentials, setSelectedCredentials] = useState<number[]>([]);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const form = useForm({
    resolver: zodResolver(insertCredentialSchema),
    defaultValues: {
      platform: "",
      accountName: "",
      url: "",
      username: "",
      password: "",
      accountIdentity: "",
      accountType: "#1-Priority",
      status: "Active",
      specialPin: "",
      recoveryNumber: "",
      recoveryEmail: "",
    },
  });

  useEffect(() => {
    if (editingCredential) {
      form.reset(editingCredential);
    }
  }, [editingCredential, form]);

  const { data: credentials, isLoading: isLoadingCredentials } = useQuery<Credential[]>({
    queryKey: ["/api/credentials"],
    staleTime: 5000,
  });

  useEffect(() => {
    if (!credentials) {
      setFilteredCredentials([]);
      return;
    }

    const searchTerm = search.toLowerCase();
    const filtered = credentials.filter((cred) => {
      const matches = [
        cred.platform.toLowerCase(),
        cred.accountName?.toLowerCase() || '',
        cred.username.toLowerCase(),
        cred.accountIdentity.toLowerCase(),
        cred.accountType.toLowerCase()
      ];
      return matches.some(field => field.includes(searchTerm));
    });
    setFilteredCredentials(filtered);
  }, [search, credentials]);

  const updateCredentialMutation = useMutation({
    mutationFn: async (data: typeof form.getValues) => {
      if (!editingCredential)
        throw new Error("No credential selected for update");
      const res = await apiRequest(
        "PATCH",
        `/api/credentials/${editingCredential.id}`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      form.reset();
      setEditingCredential(null);
      toast({
        title: "Success",
        description: "Credential updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCredentialMutation = useMutation({
    mutationFn: async (data: typeof form.getValues) => {
      const res = await apiRequest("POST", "/api/credentials", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      form.reset();
      toast({
        title: "Success",
        description: "Credential added successfully",
      });
    },
    onError: (error: Error) => {
      if (error.message.includes("already exists")) {
        toast({
          title: "Duplicate Credential",
          description:
            "This platform and username combination already exists in your credentials.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const uploadCSVMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/credentials/csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: "CSV Upload Success",
        description: `Successfully created ${data.created} credentials. ${data.errors.length ? `\nErrors: ${data.errors.join(", ")}` : ""}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "CSV Upload Failed",
        description: "Download the error report to see details",
        variant: "destructive",
        action: error.response?.data?.errorReport ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([error.response.data.errorReport], {
                type: "text/csv",
              });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "csv-error-report.csv";
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }}
          >
            Download Error Report
          </Button>
        ) : undefined,
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadCSVMutation.mutate(file);
    }
  };

  const onSubmit = (data: typeof form.getValues) => {
    if (editingCredential) {
      updateCredentialMutation.mutate(data);
    } else {
      createCredentialMutation.mutate(data);
    }
  };

  if (isLoadingCredentials) {
    return (
      <div className="min-h-screen bg-background mx-auto max-w-[1800px]">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">Credential Manager</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              {user && <UserProfile user={user} />}
              <Button variant="ghost" onClick={() => logoutMutation.mutate()}>
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 h-[200px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </div>
        </header>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background p-4 mx-auto max-w-[1800px]">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Credential Manager</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            {user && <UserProfile user={user} />}
            <Button variant="ghost" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        </div>

        <div className="space-y-8 flex flex-col items-center">
          {credentials && (
            <Card className="w-full max-w-[1400px] mx-auto">
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-6 text-center">Credential Health Dashboard</h2>
                <div className="flex flex-wrap justify-center">
                  <CredentialHealth credentials={credentials} />
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Login URL</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input
                                type="password"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  const password = e.target.value;
                                  const strength = {
                                    hasLower: /[a-z]/.test(password),
                                    hasUpper: /[A-Z]/.test(password),
                                    hasNumber: /\d/.test(password),
                                    hasSpecial: /[^A-Za-z0-9]/.test(password),
                                    isLong: password.length >= 8,
                                  };
                                  const score =
                                    Object.values(strength).filter(
                                      Boolean,
                                    ).length;
                                  const strengthClass =
                                    [
                                      "bg-destructive",
                                      "bg-destructive",
                                      "bg-orange-500",
                                      "bg-yellow-500",
                                      "bg-green-500",
                                    ][score - 1] || "bg-destructive";

                                  const indicator =
                                    document.getElementById(
                                      "password-strength",
                                    );
                                  if (indicator) {
                                    indicator.style.width = `${score * 20}%`;
                                    indicator.className = `h-1 transition-all ${strengthClass}`;
                                  }
                                }}
                              />
                              <div className="h-1 w-full bg-secondary">
                                <div
                                  id="password-strength"
                                  className="h-1 w-0 bg-destructive transition-all"
                                />
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountIdentity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Identity *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Type *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ACCOUNT_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_TYPES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="specialPin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special PIN</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="recoveryNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recovery Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="recoveryEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recovery Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        createCredentialMutation.isPending ||
                        updateCredentialMutation.isPending
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {editingCredential
                        ? "Update Credential"
                        : "Add Credential"}
                    </Button>
                    {editingCredential && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setEditingCredential(null);
                          form.reset({
                            platform: "",
                            accountName: "",
                            url: "",
                            username: "",
                            password: "",
                            accountIdentity: "",
                            accountType: "#1-Priority",
                            status: "Active",
                            specialPin: "",
                            recoveryNumber: "",
                            recoveryEmail: "",
                          });
                        }}
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Import/Export Credentials</h3>
                  <p className="text-sm text-muted-foreground">
                    Import: Upload a CSV file with columns: platform,
                    accountName, url, username, password, accountIdentity,
                    accountType, status, specialPin, recoveryNumber,
                    recoveryEmail
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                      disabled={uploadCSVMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        (window.location.href = "/api/credentials/export")
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search credentials..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Total Credentials</h3>
                    <p className="text-sm text-muted-foreground">
                      {credentials?.length || 0} credentials stored
                    </p>
                  </div>
                  {search && (
                    <div>
                      <h3 className="font-semibold">Search Results</h3>
                      <p className="text-sm text-muted-foreground">
                        {filteredCredentials.length} matches found
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="outline"
                onClick={() => {
                  const visibleCredentials = search || selectedType !== "all" || selectedStatus !== "all"
                    ? filteredCredentials
                    : credentials;
                  const allSelected =
                    visibleCredentials?.length === selectedCredentials.length;
                  setSelectedCredentials(
                    allSelected ? [] : visibleCredentials?.map((c) => c.id) || [],
                  );
                }}
              >
                {selectedCredentials.length > 0
                  ? `Selected ${selectedCredentials.length}`
                  : "Select All"}
              </Button>
              <Select
                value={selectedType}
                onValueChange={(value) => {
                  setSelectedType(value);
                  const filteredByType = credentials?.filter(
                    (cred) => value === "all" || cred.accountType === value
                  );
                  const filteredByStatus = filteredByType?.filter(
                    (cred) => selectedStatus === "all" || cred.status === selectedStatus
                  );
                  const filteredBySearch = search
                    ? filteredByStatus?.filter((cred) =>
                        cred.platform.toLowerCase().includes(search.toLowerCase()) ||
                        cred.accountName?.toLowerCase().includes(search.toLowerCase()) ||
                        cred.username.toLowerCase().includes(search.toLowerCase()) ||
                        cred.accountIdentity.toLowerCase().includes(search.toLowerCase())
                      )
                    : filteredByStatus;
                  setFilteredCredentials(filteredBySearch || []);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Account Types</SelectItem>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedStatus}
                onValueChange={(value) => {
                  setSelectedStatus(value);
                  const filteredByStatus = credentials?.filter(
                    (cred) => value === "all" || cred.status === value
                  );
                  const filteredByType = filteredByStatus?.filter(
                    (cred) => selectedType === "all" || cred.accountType === selectedType
                  );
                  const filteredBySearch = search
                    ? filteredByType?.filter((cred) =>
                        cred.platform.toLowerCase().includes(search.toLowerCase()) ||
                        cred.accountName?.toLowerCase().includes(search.toLowerCase()) ||
                        cred.username.toLowerCase().includes(search.toLowerCase()) ||
                        cred.accountIdentity.toLowerCase().includes(search.toLowerCase())
                      )
                    : filteredByType;
                  setFilteredCredentials(filteredBySearch || []);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_TYPES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCredentials.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const deleteCredentials = async () => {
                      const promises = selectedCredentials.map(id =>
                        apiRequest("DELETE", `/api/credentials/${id}`)
                          .catch(() => null)
                      );
                      await Promise.all(promises);
                    };

                    try {
                      await deleteCredentials();
                      await queryClient.invalidateQueries({
                        queryKey: ["/api/credentials"],
                      });
                      setSelectedCredentials([]);
                      toast({
                        title: "Success",
                        description: "Selected credentials deleted successfully"
                      });
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: "Failed to delete some credentials",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Delete Selected
                </Button>
              )}
            </div>
            <div className="space-y-4 min-h-[1050px] max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
              {(search || selectedType !== "all" || selectedStatus !== "all" ? filteredCredentials : credentials)
                ?.sort(
                  (a, b) =>
                    new Date(b.lastChanged).getTime() -
                    new Date(a.lastChanged).getTime(),
                )
                .map((cred) => (
                  <Card key={cred.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start gap-4">
                        <Checkbox
                          checked={selectedCredentials.includes(cred.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCredentials([
                                ...selectedCredentials,
                                cred.id,
                              ]);
                            } else {
                              setSelectedCredentials(
                                selectedCredentials.filter(
                                  (id) => id !== cred.id,
                                ),
                              );
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="space-y-2 flex-1 mr-4">
                          <h3 className="font-semibold">{cred.platform}</h3>
                          <div className="grid grid-cols-2 gap-2 text-sm break-words">
                            <p className="text-muted-foreground">
                              <span className="font-medium">
                                Platform Name:
                              </span>{" "}
                              {cred.platform}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Account Name:</span>{" "}
                              {cred.accountName}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Login URL:</span>{" "}
                              {cred.url}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Username:</span>{" "}
                              {cred.username}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-muted-foreground flex-1">
                                <span className="font-medium">Password:</span>{" "}
                                {showPassword === cred.id
                                  ? cred.password
                                  : "••••••••"}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  setShowPassword(
                                    showPassword === cred.id ? null : cred.id,
                                  )
                                }
                              >
                                {showPassword === cred.id ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-muted-foreground">
                              <span className="font-medium">
                                Account Identity:
                              </span>{" "}
                              {cred.accountIdentity}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Account Type:</span>{" "}
                              {cred.accountType}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Status:</span>{" "}
                              {cred.status}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Special PIN:</span>{" "}
                              {cred.specialPin}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">
                                Recovery Phone:
                              </span>{" "}
                              {cred.recoveryNumber}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">
                                Recovery Email:
                              </span>{" "}
                              {cred.recoveryEmail}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Last Changed:</span>{" "}
                              {cred.lastChanged
                                ? new Date(cred.lastChanged).toLocaleString()
                                : "Never"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingCredential(cred)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              try {
                                await apiRequest(
                                  "DELETE",
                                  `/api/credentials/${cred.id}`,
                                );
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/credentials"],
                                });
                                toast({
                                  title: "Success",
                                  description:
                                    "Credential deleted successfully",
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Error",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              {search && filteredCredentials.length === 0 && (
                <p className="text-center text-muted-foreground">
                  No credentials found
                </p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}