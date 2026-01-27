"use client"

import { Menu } from "lucide-react"
import { SideBar } from "./Sidebar"
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export function MobileNav() {
    return (
        <div className="lg:hidden p-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-emerald-500" fill="currentColor">
                        <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                    </svg>
                </div>
                <span className="text-lg font-semibold text-gray-800">Hirevoo</span>
            </div>

            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-600">
                        <Menu className="w-6 h-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85vw] max-w-[300px]">
                    <SideBar mobile />
                </SheetContent>
            </Sheet>
        </div>
    )
}
