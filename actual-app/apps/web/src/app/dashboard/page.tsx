'use client';

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect } from "react";
import { BookOpenText, Plus, FileText, Clock, Building2, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Project {
    _id: string;
    title: string;
    university: string;
    status: string;
    updatedAt: string;
}

export default function DashboardPage() {
    const { user } = useUser();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal & Form States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [university, setUniversity] = useState("JUW");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const router = useRouter();

    // 1. Fetch live projects from MongoDB on component mount
    const fetchProjects = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/projects");
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (err) {
            console.error("Failed to load projects:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchProjects();
        }
    }, [user]);

    // Handle creating a new project via the API route
    // Handle creating a new project via the API route
    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsSubmitting(true);
        console.log("Submitting new project:", { title, university });

        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, university }),
            });

            console.log("API Response Status:", res.status);

            if (res.ok) {
                const data = await res.json();
                console.log("API Response Data:", data);

                // Reset form fields aur modal close kiya
                setTitle("");
                setUniversity("JUW");
                setIsModalOpen(false);

                // Dynamic Redirect to the Editor page!
                if (data.projectId) {
                    console.log("Redirecting to editor:", data.projectId);
                    router.push(`/editor/${data.projectId}`);
                } else {
                    console.warn("projectId missing from response, fetching list instead.");
                    await fetchProjects(); // Fallback agar id na mile
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error("Server error data:", errorData);
                alert(errorData.error || `Failed to create project. Server returned status: ${res.status}`);
            }
        } catch (err) {
            console.error("Failed to create project exception:", err);
            alert("An error occurred while communicating with the database setup route.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white relative">
            {/* Header Navigation */}
            <header className="border-b border-gray-100 bg-white">
                <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
                    <Link href="/dashboard" className="flex items-center gap-2 text-[#6F155F] transition-opacity hover:opacity-90">
                        <BookOpenText className="h-5 w-5" />
                        <span className="font-semibold text-lg tracking-tight">ReportPeer AI</span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-medium hidden sm:inline">
                            {user?.fullName || "Loading..."}
                        </span>
                        <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
                    </div>
                </div>
            </header>

            {/* Main Content View */}
            <main className="max-w-6xl mx-auto px-6 py-12">
                {/* Workspace Action Bar */}
                <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
                    <div>
                        <h1 className="font-serif text-4xl text-slate-900 tracking-tight">Your projects</h1>
                        <p className="mt-1.5 text-sm text-gray-500">
                            Every report kept in your university's format.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6F155F] hover:bg-[#57104b] text-white px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        Create new project
                    </button>
                </div>

                {/* Loading Spinner State */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400">
                        <Loader2 className="h-8 w-8 animate-spin text-[#6F155F]" />
                        <p className="text-sm mt-2 font-medium">Fetching workspace entries...</p>
                    </div>
                ) : projects.length === 0 ? (
                    /* Empty State Initializer Card */
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="rounded-xl border-2 border-dashed border-gray-200 p-6 grid place-items-center min-h-[220px] text-gray-400 hover:border-[#6F155F]/40 hover:text-[#6F155F] transition-all bg-white w-full cursor-pointer"
                        >
                            <div className="text-center">
                                <Plus className="h-6 w-6 mx-auto stroke-[2.5]" />
                                <div className="mt-2 text-sm font-semibold tracking-tight">New project</div>
                            </div>
                        </button>
                    </div>
                ) : (
                    /* Live Dynamic Project Grid Matrix */
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <Link
                                key={project._id}
                                href={`/editor/${project._id}`}
                                className="group flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-2xs hover:border-[#6F155F]/30 hover:shadow-sm transition-all"
                            >
                                <div>
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-lg bg-[#6F155F]/10 grid place-items-center text-[#6F155F]">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8A93B]">
                                            {project.status || "In progress"}
                                        </span>
                                    </div>

                                    <h3 className="mt-5 font-serif text-xl text-slate-900 leading-snug group-hover:text-[#6F155F] transition-colors">
                                        {project.title}
                                    </h3>
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-400 font-medium">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                        {project.university}
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                                        Updated {new Date(project.updatedAt).toLocaleDateString() === new Date().toLocaleDateString() ? 'Today' : new Date(project.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {/* Quick Plus Card at the end of the existing project grid */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="rounded-xl border-2 border-dashed border-gray-200 p-6 grid place-items-center min-h-[220px] text-gray-400 hover:border-[#6F155F]/40 hover:text-[#6F155F] transition-all bg-white cursor-pointer"
                        >
                            <div className="text-center">
                                <Plus className="h-6 w-6 mx-auto stroke-[2.5]" />
                                <div className="mt-2 text-sm font-semibold tracking-tight">New project</div>
                            </div>
                        </button>
                    </div>
                )}
            </main>

            {/* Creation Configuration Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <h2 className="font-serif text-2xl text-slate-900 tracking-tight mb-1">Create new project</h2>
                        <p className="text-xs text-gray-500 mb-6">Set up your workspace parameters below to configure your custom document layout guidelines.</p>

                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Project / Thesis Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., AI-Powered Traffic Signal Optimization"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#6F155F] focus:ring-1 focus:ring-[#6F155F] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Target University Template</label>
                                <select
                                    value={university}
                                    onChange={(e) => setUniversity(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-[#6F155F] focus:ring-1 focus:ring-[#6F155F] transition-all"
                                >
                                    <option value="JUW">Jinnah University for Women (JUW)</option>
                                    <option value="NED University">NED University</option>
                                    <option value="IBA">IBA Karachi</option>
                                    <option value="FAST-NUCES">FAST-NUCES</option>
                                </select>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-50 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6F155F] hover:bg-[#57104b] text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        "Initialize Workspace"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}