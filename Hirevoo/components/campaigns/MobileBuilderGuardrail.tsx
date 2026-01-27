"use client"

import { AlertTriangle, Pause, Play } from "lucide-react"

export function MobileBuilderGuardrail() {
    return (
        <div className="md:hidden flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-100px)]">
            <div className="bg-amber-50 p-4 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Desktop Required for Editing
            </h3>
            <p className="text-sm text-gray-600 max-w-xs mb-8">
                The campaign builder is optimized for desktop screens. Please switch to a larger device to edit your workflow.
            </p>

            <div className="w-full max-w-xs bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-center text-gray-500 mb-2">Quick Actions</p>
                <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed">
                        <Pause className="w-4 h-4" />
                        Pause
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed">
                        <Play className="w-4 h-4" />
                        Resume
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Actions unavailable in preview</p>
            </div>
        </div>
    )
}
