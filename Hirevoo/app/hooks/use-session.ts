import { useState, useEffect } from "react"

export function useSession() {
  const [user, setUser] = useState<{
    name: string
    email: string
    avatar?: string
    role?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching user session
    const timer = setTimeout(() => {
      setUser({
        name: "Rohit Thakur",
        email: "rohit@example.com",
        avatar: "",
        role: "Administrator",
      })
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return { user, isLoading }
}
