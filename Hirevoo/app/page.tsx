'use client';

import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Wand2,
  Target,
  Send,
  BarChart3,
  Zap,
  CheckCircle,
  Moon,
  Sun,
  Star,
  X,
} from 'lucide-react';

// Hirevoo Logo Mark - Minimal, clean & unique icon
const HirevooMark = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* Stylized "H" with forward momentum arrow - represents hiring/outreach */}
    <path
      d="M5 5V19M5 12H13"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M13 7L18 12L13 17"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="19.5" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

// Signup Modal Component
const SignupModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl z-50 mx-4"
        >
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
          
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gray-900 dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HirevooMark className="h-6 w-6 text-white dark:text-gray-900" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Create your account</h3>
          </div>

          <button className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-6">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-900 text-gray-500">or</span>
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Your email"
              className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white text-gray-900 dark:text-white"
            />
            <input
              type="password"
              placeholder="Create a password"
              className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white text-gray-900 dark:text-white"
            />
            <button className="w-full px-6 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Continue with email
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account? <Link href="/login" className="text-gray-900 dark:text-white underline">Sign in</Link>
          </p>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// Smooth scroll section component
const ScrollSection = ({ 
  children, 
  className = '',
  delay = 0 
}: { 
  children: React.ReactNode; 
  className?: string;
  delay?: number;
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [60, 0, 0, -60]);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 });
  const smoothOpacity = useSpring(opacity, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      style={{ opacity: smoothOpacity, y: smoothY }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Parallax element
const ParallaxElement = ({ 
  children, 
  speed = 0.5,
  className = '' 
}: { 
  children?: React.ReactNode; 
  speed?: number;
  className?: string;
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [100 * speed, -100 * speed]);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <motion.div ref={ref} style={{ y: smoothY }} className={className}>
      {children}
    </motion.div>
  );
};

export default function LandingPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showSignup, setShowSignup] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = stored ? (stored as 'light' | 'dark') : prefersDark ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    
    // Trigger animations after mount
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#F8F9FB] dark:bg-[#0a0a0b] overflow-hidden">

      {/* Signup Modal */}
      <SignupModal isOpen={showSignup} onClose={() => setShowSignup(false)} />

      {/* Navigation */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-40 bg-[#F8F9FB]/60 dark:bg-[#0a0a0b]/60 backdrop-blur-lg"
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex w-full items-center justify-between rounded-full border border-gray-200/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur dark:border-gray-800/70 dark:bg-[#0a0a0b]/80">
            <Link href="/" className="flex items-center gap-2.5 pl-1">
              <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                <HirevooMark className="h-5 w-5 text-white dark:text-gray-900" />
              </div>
              <span className="font-semibold text-sm text-gray-900 dark:text-white tracking-tight">Hirevoo</span>
            </Link>

            <div className="hidden md:flex items-center gap-2">
              <Link href="#how" className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition-colors">
                Product
              </Link>
              <Link href="#features" className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition-colors">
                Pricing
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle - hidden on mobile */}
              <button
                onClick={toggleTheme}
                className="hidden md:flex p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                {theme === 'light' ? (
                  <Moon className="h-4 w-4 text-gray-600" />
                ) : (
                  <Sun className="h-4 w-4 text-gray-400" />
                )}
              </button>

              <Link
                href="/login"
                className="inline-flex px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-32 min-h-screen flex items-center overflow-hidden">
        {/* Subtle gradient orbs with parallax */}
        <ParallaxElement speed={0.3} className="absolute top-20 left-1/4 w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50" />
        <ParallaxElement speed={0.5} className="absolute top-40 right-1/4 w-80 h-80 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl opacity-40" />
        
        {/* Curved Pill Shapes on Sides (Large screens only) */}
        <div className="hidden lg:block absolute -left-20 xl:-left-10 top-24 bottom-24 w-48 xl:w-64 pointer-events-none">
          <div
            className="w-full h-full rounded-r-[100px] bg-gradient-to-br from-gray-400/60 via-gray-300/50 to-gray-200/30 dark:from-gray-700/70 dark:via-gray-700/50 dark:to-gray-800/30"
            style={{
              clipPath: 'polygon(0% 0%, 35% 0%, 100% 100%, 0% 100%)',
            }}
          />
        </div>
        <div className="hidden lg:block absolute -right-20 xl:-right-10 top-24 bottom-24 w-48 xl:w-64 pointer-events-none">
          <div
            className="w-full h-full rounded-l-[100px] bg-gradient-to-bl from-gray-400/60 via-gray-300/50 to-gray-200/30 dark:from-gray-700/70 dark:via-gray-700/50 dark:to-gray-800/30"
            style={{
              clipPath: 'polygon(65% 0%, 100% 0%, 100% 100%, 0% 100%)',
            }}
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          {/* Main Headline */}
          <div className="text-center max-w-4xl mx-auto mb-16">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-6"
            >
              Reach. Connect.
              <br />
              <span className="text-gray-400 dark:text-gray-500">Get Hired.</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10"
            >
              Skip the job boards. Email hiring managers directly with AI-personalized 
              outreach. 23% response rate vs 2% on traditional applications.
            </motion.p>

            {/* Dot indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isLoaded ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="flex items-center justify-center gap-3 mb-12"
            >
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
              <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center">
                <HirevooMark className="h-5 w-5 text-white dark:text-gray-900" />
              </div>
              <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            </motion.div>
          </div>

          {/* Three Floating Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Card 1 - Import Contacts */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.8, type: "spring", stiffness: 100 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="bg-gray-200/90 dark:bg-gray-800 rounded-3xl p-5 shadow-xl shadow-gray-400/40 dark:shadow-black/40"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-4">Bring your contacts</p>
              
              {/* Contact List */}
              <div className="space-y-3">
                {[
                  { name: "Sarah Chen", role: "CTO", company: "Vercel", match: true },
                  { name: "James Park", role: "Eng Manager", company: "Linear", match: true },
                  { name: "Maria Lopez", role: "VP Engineering", company: "Notion", match: false },
                ].map((contact, i) => (
                  <motion.div
                    key={contact.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isLoaded ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.4, delay: 1.2 + i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{contact.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{contact.role} · {contact.company}</p>
                    </div>
                    {contact.match && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">Upload a CSV or paste emails to get started.</p>
              </div>
            </motion.div>

            {/* Card 2 - AI Email Writer (Center, Primary) */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 1, type: "spring", stiffness: 100 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="bg-gray-900 dark:bg-white rounded-3xl p-5 shadow-xl shadow-gray-900/20 dark:shadow-gray-200/50"
            >
              {/* Email Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Wand2 className="h-3 w-3 text-white" />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">AI is writing...</span>
              </div>
              
              {/* Email Content */}
              <div className="bg-gray-800 dark:bg-gray-100 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">To: sarah@vercel.com</p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isLoaded ? { opacity: 1 } : {}}
                  transition={{ delay: 1.3 }}
                >
                  <p className="text-sm text-white dark:text-gray-900 leading-relaxed">
                    Hi Sarah,
                    <br /><br />
                    <span className="text-emerald-400 dark:text-emerald-600">Loved your talk at Next.js Conf</span> — the edge rendering 
                    insights were fascinating.
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 align-middle"
                    />
                  </p>
                </motion.div>
              </div>

              <button
                onClick={() => setShowSignup(true)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Get Started
              </button>
            </motion.div>

            {/* Card 3 - Application Pipeline */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={isLoaded ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 1.2, type: "spring", stiffness: 100 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="bg-gray-200/90 dark:bg-gray-800 rounded-3xl p-5 shadow-xl shadow-gray-400/40 dark:shadow-black/40"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-4">Your pipeline</p>
              
              {/* Mini Kanban */}
              <div className="flex gap-2 mb-4">
                {[
                  { label: "Sent", count: 12, color: "bg-gray-200 dark:bg-gray-700" },
                  { label: "Opened", count: 8, color: "bg-blue-100 dark:bg-blue-900/40" },
                  { label: "Replied", count: 4, color: "bg-emerald-100 dark:bg-emerald-900/40" },
                ].map((stage, i) => (
                  <motion.div
                    key={stage.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isLoaded ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1.4 + i * 0.1 }}
                    className={`flex-1 ${stage.color} rounded-xl p-3 text-center`}
                  >
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{stage.count}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{stage.label}</p>
                  </motion.div>
                ))}
              </div>
              
              {/* Recent Activity */}
              <div className="space-y-2">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={isLoaded ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 1.8 }}
                  className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">New reply from Linear!</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={isLoaded ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 2 }}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Vercel opened your email</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* How it Works - Horizontal Layout */}
      <section id="how" className="py-24 bg-white dark:bg-[#0a0a0b]">
        <div className="container mx-auto px-6">
          <ScrollSection className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">How it works</span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mt-4 tracking-tight">
              Three simple steps
            </h2>
          </ScrollSection>

          {/* Three Steps in a Row */}
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 relative">
              {/* Connecting Lines (Desktop only) */}
              <div className="hidden md:block absolute top-24 left-[22%] right-[22%] h-0.5">
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 origin-left"
                />
              </div>

              {/* Step 1 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-100 dark:bg-gray-800/80 rounded-3xl p-8 h-full relative shadow-sm"
                >
                  <div className="flex justify-center mb-6">
                    <span className="inline-flex items-center justify-center w-12 h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-lg font-bold">
                      1
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">
                    Add your contacts
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6">
                    Upload a CSV file or paste emails from your contact list
                  </p>
                  
                  {/* Visual - File Upload */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-3"
                      >
                        <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </motion.div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Drop CSV here</p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                    </div>
                  </div>
                </motion.div>
              </ScrollSection>

              {/* Step 2 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-900 dark:bg-white rounded-3xl p-8 h-full relative"
                >
                  <div className="flex justify-center mb-6">
                    <span className="inline-flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-full text-lg font-bold">
                      2
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-white dark:text-gray-900 mb-3 text-center">
                    AI crafts your emails
                  </h3>
                  <p className="text-gray-400 dark:text-gray-500 text-center text-sm mb-6">
                    Watch the magic happen in seconds
                  </p>
                  
                  {/* Visual - AI Writing */}
                  <div className="bg-gray-800 dark:bg-gray-100 rounded-2xl p-4">
                    <div className="space-y-2">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-2.5 bg-gray-700 dark:bg-gray-200 rounded"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "85%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="h-2.5 bg-gray-700 dark:bg-gray-200 rounded"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "70%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="h-2.5 bg-gray-700 dark:bg-gray-200 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-2 h-2 bg-emerald-400 rounded-full"
                      />
                      <span className="text-xs text-gray-400 dark:text-gray-500">AI is writing...</span>
                    </div>
                  </div>
                </motion.div>
              </ScrollSection>

              {/* Step 3 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-100 dark:bg-gray-800/80 rounded-3xl p-8 h-full relative shadow-sm"
                >
                  <div className="flex justify-center mb-6">
                    <span className="inline-flex items-center justify-center w-12 h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-lg font-bold">
                      3
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">
                    Send & get responses
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6">
                    One click to send, then watch replies come in
                  </p>
                  
                  {/* Visual - Send Button & Stats */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl mb-4 flex items-center justify-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Send All
                    </motion.button>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">24</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sent</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">6</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Replies</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </ScrollSection>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Redesigned */}
      <section id="features" className="py-24 bg-[#F8F6F3] dark:bg-[#0a0a0b]">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            {/* Header with illustration */}
            <ScrollSection>
              <div className="flex flex-col lg:flex-row items-start justify-between gap-12 mb-20">
                {/* Left side - Title & CTA */}
                <div className="max-w-xl">
                  <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                    How <span className="text-purple-600 dark:text-purple-400">Hirevoo</span> Can Boost Your Job Search
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-6 text-lg leading-relaxed">
                    Land interviews faster with AI-powered cold emails. Skip the job boards and connect directly with hiring managers.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowSignup(true)}
                    className="mt-8 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    Get started
                  </motion.button>
                </div>

                {/* Right side - Creative Illustration */}
                <div className="relative w-full lg:w-auto flex-shrink-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative"
                  >
                    {/* Floating email card illustration */}
                    <div className="relative w-64 h-48">
                      {/* Background shapes */}
                      <div className="absolute -top-4 -left-4 w-32 h-32 bg-purple-200 dark:bg-purple-900/30 rounded-full blur-2xl opacity-60" />
                      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-200 dark:bg-blue-900/30 rounded-full blur-2xl opacity-60" />
                      
                      {/* Main card */}
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-0 left-0 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 border border-gray-100 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <Mail className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-20" />
                          </div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-full" />
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-4/5" />
                          <div className="h-2 bg-purple-100 dark:bg-purple-900/30 rounded w-3/5" />
                        </div>
                      </motion.div>

                      {/* Small floating badge */}
                      <motion.div
                        animate={{ y: [0, 6, 0], x: [0, -3, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        className="absolute bottom-4 right-0 bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg"
                      >
                        ✓ Sent
                      </motion.div>

                      {/* Cursor icon */}
                      <motion.div
                        animate={{ x: [0, 10, 0], y: [0, 5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute top-16 right-8"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-800 dark:text-white">
                          <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="currentColor" />
                        </svg>
                      </motion.div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </ScrollSection>

            {/* Features Grid - 3x2 */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12">
              {/* Feature 1 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                >
                  <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Wand2 className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    AI-powered personalization
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Every email is uniquely crafted using AI that researches the company, their tech stack, and recent news automatically.
                  </p>
                </motion.div>
              </ScrollSection>

              {/* Feature 2 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                >
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Target className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    Smart contact targeting
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Import your contacts via CSV or paste emails directly. Our AI identifies the best people to reach at each company.
                  </p>
                </motion.div>
              </ScrollSection>

              {/* Feature 3 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                >
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    Real-time tracking & analytics
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Know exactly when your email is opened, clicked, or replied to. Get instant notifications for hot leads.
                  </p>
                </motion.div>
              </ScrollSection>

              {/* Feature 4 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                >
                  <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Zap className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    Automated follow-ups
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Set up smart follow-up sequences that automatically send based on recipient behavior. Never miss a warm lead.
                  </p>
                </motion.div>
              </ScrollSection>

              {/* Feature 5 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                >
                  <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    Spam score detection
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    AI analyzes your email before sending and suggests improvements to ensure maximum deliverability to inbox.
                  </p>
                </motion.div>
              </ScrollSection>

              {/* Feature 6 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                >
                  <div className="w-14 h-14 bg-cyan-100 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Send className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    One-click bulk sending
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Send personalized emails to hundreds of contacts with a single click. Each one feels handwritten and unique.
                  </p>
                </motion.div>
              </ScrollSection>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white dark:bg-[#0a0a0b]">
        <div className="container mx-auto px-6">
          <ScrollSection className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mt-4 tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-4">
              Choose the plan that fits your job search needs
            </p>
          </ScrollSection>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <ScrollSection>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-200 dark:bg-gray-800/80 rounded-3xl p-8 h-full flex flex-col"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Free</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Perfect for getting started</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
                  <span className="text-gray-500 dark:text-gray-400">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['10 emails per day', 'Basic AI personalization', 'Email tracking', 'Community support'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSignup(true)}
                  className="w-full py-3 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Get Started
                </button>
              </motion.div>
            </ScrollSection>

            {/* Pro Tier - Highlighted */}
            <ScrollSection>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-900 dark:bg-white rounded-3xl p-8 h-full flex flex-col relative"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">Most Popular</span>
                </div>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white dark:text-gray-900 mb-2">Pro</h3>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">For serious job seekers</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white dark:text-gray-900">₹199</span>
                  <span className="text-gray-400 dark:text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['50 emails per day', 'Advanced AI personalization', 'Real-time analytics', 'Follow-up sequences', 'Priority support'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-300 dark:text-gray-600">
                      <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSignup(true)}
                  className="w-full py-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Get Started
                </button>
              </motion.div>
            </ScrollSection>

            {/* Max Tier */}
            <ScrollSection>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-200 dark:bg-gray-800/80 rounded-3xl p-8 h-full flex flex-col"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Max</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">For power users & teams</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">₹299</span>
                  <span className="text-gray-500 dark:text-gray-400">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['Unlimited emails per day', 'Premium AI personalization', 'Advanced analytics dashboard', 'Custom automation workflows', 'Dedicated account manager', 'API access'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSignup(true)}
                  className="w-full py-3 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Get Started
                </button>
              </motion.div>
            </ScrollSection>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Redesigned */}
      <section id="testimonials" className="py-24 bg-white dark:bg-[#0a0a0b] relative overflow-hidden">
        <div className="container mx-auto px-6">
          {/* Header - Left aligned like reference */}
          <div className="max-w-6xl mx-auto mb-16">
            <ScrollSection>
              <div className="max-w-lg">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                  What Job Seekers Say About Hirevoo?
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-4 text-lg">
                  Let's see what they say about how Hirevoo helped them land their dream jobs.
                </p>
              </div>
            </ScrollSection>
          </div>

          {/* Testimonials Grid - 2 columns with featured card */}
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Testimonial 1 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 h-full flex flex-col shadow-sm hover:shadow-xl transition-shadow"
                >
                  {/* Quote Icon */}
                  <div className="text-5xl font-serif text-gray-900 dark:text-white leading-none mb-4">"</div>
                  
                  {/* Quote Text */}
                  <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed flex-1 mb-8">
                    I'd spend hours applying through job boards with zero responses. Now, I can directly reach hiring managers with{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">personalized emails that actually get read.</span>
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      R
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Ricky Chen</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Software Engineer at <span className="font-medium">Stripe</span></p>
                    </div>
                  </div>
                </motion.div>
              </ScrollSection>

              {/* Testimonial 2 */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 h-full flex flex-col shadow-sm hover:shadow-xl transition-shadow"
                >
                  {/* Quote Icon */}
                  <div className="text-5xl font-serif text-gray-900 dark:text-white leading-none mb-4">"</div>
                  
                  {/* Quote Text */}
                  <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed flex-1 mb-8">
                    As a remote job seeker, reaching companies across time zones was a nightmare.{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">Hirevoo's AI writes emails that feel genuinely personal</span> — I got 5 interviews in my first week!
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      M
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Millie Rodriguez</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Product Manager at <span className="font-medium">Notion</span></p>
                    </div>
                  </div>
                </motion.div>
              </ScrollSection>

              {/* Featured Card - Dark */}
              <ScrollSection>
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-900 dark:bg-white rounded-2xl p-8 h-full flex flex-col shadow-xl"
                >
                  {/* Logo/Icon */}
                  <div className="w-16 h-16 bg-gray-800 dark:bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                    <HirevooMark className="h-8 w-8 text-white dark:text-gray-900" />
                  </div>
                  
                  {/* Stats */}
                  <div className="mb-6">
                    <div className="text-5xl font-bold text-white dark:text-gray-900 mb-2">23%</div>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">Average response rate</p>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300 dark:text-gray-600 text-sm">10x higher than job boards</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300 dark:text-gray-600 text-sm">2,500+ job seekers helped</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300 dark:text-gray-600 text-sm">500+ dream jobs landed</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-800 dark:border-gray-200">
                    <p className="text-emerald-400 dark:text-emerald-600 font-semibold text-lg">Trusted & Verified</p>
                  </div>
                </motion.div>
              </ScrollSection>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - Clean */}
      <section className="py-24 bg-[#F8F9FB] dark:bg-[#0a0a0b]">
        <div className="container mx-auto px-6">
          <ScrollSection className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-6">
              Ready to land your
              <br />
              dream job?
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-10">
              Join 2,500+ job seekers who've landed interviews at top companies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSignup(true)}
                className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Get Started Free
              </motion.button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="#how">
                  <button className="w-full sm:w-auto px-8 py-4 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    See how it works
                  </button>
                </Link>
              </motion.div>
            </div>
            <p className="text-sm text-gray-400 mt-6">No credit card required • Free forever plan</p>
          </ScrollSection>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="py-8 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0b]">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                <HirevooMark className="h-4 w-4 text-white dark:text-gray-900" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Hirevoo</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <Link href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</Link>
              <Link href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Contact</Link>
            </div>
            <p className="text-sm text-gray-400">© 2024 Hirevoo</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
