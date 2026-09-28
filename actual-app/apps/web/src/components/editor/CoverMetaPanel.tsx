"use client";

import type { Dispatch, SetStateAction } from "react";

export interface TeamMember {
    name: string;
    enrollment: string;
    seatNumber: string;
}

export interface CoverMeta {
    projectTitle: string;
    projectAdvisor: string;
    submissionMonth: string;
    submissionYear: string;
    internalExaminer: string;
    internalExaminerDesignation: string;
    externalExaminer: string;
    externalExaminerDesignation: string;
    externalExaminerOrganization: string;
    headOfDepartment: string;
    teamMembers: TeamMember[];
    universityLogo: {
        dataUrl: string;
        fileName: string;
        mimeType: string;
    } | null;
}

type Props = {
    coverMeta: CoverMeta;
    setCoverMeta: Dispatch<SetStateAction<CoverMeta>>;
    onAddTeamMember: () => void;
};

export function CoverMetaPanel({ coverMeta, setCoverMeta, onAddTeamMember }: Props) {
    return (
        <div className="mx-6 sm:mx-8 mt-6 mb-4 border border-slate-200 rounded-lg p-4 bg-slate-50/90 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Title Page &amp; Project Approval</h3>
            <p className="text-xs text-slate-500">
                Formatting is fixed by ReportPeer. Edit only the project-specific fields below.
            </p>
            <div className="space-y-2">
                <span className="text-xs font-medium text-slate-700">University Logo</span>
                <p className="text-[11px] text-slate-500">
                    Uploaded logo is placed automatically at the template position and size. Leave empty to keep the reserved logo space.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-xs border border-gray-200 hover:border-[#6F155F] hover:text-[#6F155F] rounded-md px-2.5 py-1.5 cursor-pointer">
                        Upload logo
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const dataUrl = typeof reader.result === "string" ? reader.result : "";
                                    if (!dataUrl) return;
                                    setCoverMeta((m) => ({
                                        ...m,
                                        universityLogo: {
                                            dataUrl,
                                            fileName: file.name,
                                            mimeType: file.type || "image/png",
                                        },
                                    }));
                                };
                                reader.readAsDataURL(file);
                            }}
                        />
                    </label>
                    {coverMeta.universityLogo && (
                        <>
                            <img
                                src={coverMeta.universityLogo.dataUrl}
                                alt="University logo preview"
                                className="h-12 w-12 object-contain border border-gray-200 rounded bg-white"
                            />
                            <button
                                type="button"
                                className="text-xs text-red-600"
                                onClick={() => setCoverMeta((m) => ({ ...m, universityLogo: null }))}
                            >
                                Remove
                            </button>
                        </>
                    )}
                </div>
            </div>
            <label className="block text-xs text-slate-600">
                Project Title
                <input
                    className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                    value={coverMeta.projectTitle}
                    onChange={(e) => setCoverMeta((m) => ({ ...m, projectTitle: e.target.value }))}
                />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-600">
                    Submission Month
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.submissionMonth}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, submissionMonth: e.target.value }))}
                        placeholder="e.g. September"
                    />
                </label>
                <label className="block text-xs text-slate-600">
                    Submission Year
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.submissionYear}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, submissionYear: e.target.value }))}
                        placeholder="e.g. 2026"
                    />
                </label>
            </div>
            <label className="block text-xs text-slate-600">
                Project Advisor
                <input
                    className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                    value={coverMeta.projectAdvisor}
                    onChange={(e) => setCoverMeta((m) => ({ ...m, projectAdvisor: e.target.value }))}
                />
            </label>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Students (up to 4)</span>
                    <button
                        type="button"
                        className="text-xs text-[#6F155F] disabled:opacity-40"
                        disabled={coverMeta.teamMembers.length >= 4}
                        onClick={onAddTeamMember}
                    >
                        + Add student
                    </button>
                </div>
                {coverMeta.teamMembers.map((member, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                            className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                            placeholder="Name"
                            value={member.name}
                            onChange={(e) =>
                                setCoverMeta((m) => {
                                    const teamMembers = [...m.teamMembers];
                                    teamMembers[index] = { ...teamMembers[index], name: e.target.value };
                                    return { ...m, teamMembers };
                                })
                            }
                        />
                        <input
                            className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                            placeholder="Enrolment"
                            value={member.enrollment}
                            onChange={(e) =>
                                setCoverMeta((m) => {
                                    const teamMembers = [...m.teamMembers];
                                    teamMembers[index] = { ...teamMembers[index], enrollment: e.target.value };
                                    return { ...m, teamMembers };
                                })
                            }
                        />
                        <input
                            className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                            placeholder="Seat Number"
                            value={member.seatNumber}
                            onChange={(e) =>
                                setCoverMeta((m) => {
                                    const teamMembers = [...m.teamMembers];
                                    teamMembers[index] = { ...teamMembers[index], seatNumber: e.target.value };
                                    return { ...m, teamMembers };
                                })
                            }
                        />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-600">
                    Internal Advisor Name
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.internalExaminer}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, internalExaminer: e.target.value }))}
                    />
                </label>
                <label className="block text-xs text-slate-600">
                    Internal Advisor Designation
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.internalExaminerDesignation}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, internalExaminerDesignation: e.target.value }))}
                    />
                </label>
                <label className="block text-xs text-slate-600">
                    External Advisor Name
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.externalExaminer}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, externalExaminer: e.target.value }))}
                    />
                </label>
                <label className="block text-xs text-slate-600">
                    External Advisor Designation
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.externalExaminerDesignation}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, externalExaminerDesignation: e.target.value }))}
                    />
                </label>
                <label className="block text-xs text-slate-600 sm:col-span-2">
                    External Advisor Organization
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.externalExaminerOrganization}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, externalExaminerOrganization: e.target.value }))}
                    />
                </label>
                <label className="block text-xs text-slate-600 sm:col-span-2">
                    Head of Department
                    <input
                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                        value={coverMeta.headOfDepartment}
                        onChange={(e) => setCoverMeta((m) => ({ ...m, headOfDepartment: e.target.value }))}
                    />
                </label>
            </div>
        </div>
    );
}
