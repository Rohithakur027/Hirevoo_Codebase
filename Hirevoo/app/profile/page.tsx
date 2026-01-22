'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SideBar } from '@/components/layout/SideBar';
import { SidebarProvider } from '@/context/SidebarContext';
import { useSession } from '@/app/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockUserProfile, mockUserProjects, availableRoles, availableLocations, techStackOptions } from '@/lib/mock-data';
import {
  User,
  Briefcase,
  Code2,
  Link as LinkIcon,
  FileText,
  Plus,
  X,
  ExternalLink,
  Github,
  Linkedin,
  Edit3,
  Save,
  Trash2,
} from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState(mockUserProfile);
  const [projects, setProjects] = useState(mockUserProjects);
  const [skillInput, setSkillInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleAddSkill = (skill: string) => {
    if (skill && !profile.techStack.includes(skill)) {
      setProfile({ ...profile, techStack: [...profile.techStack, skill] });
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    setProfile({ ...profile, techStack: profile.techStack.filter(s => s !== skill) });
  };

  const handleRoleToggle = (role: string) => {
    const newRoles = profile.targetRoles.includes(role)
      ? profile.targetRoles.filter(r => r !== role)
      : [...profile.targetRoles, role];
    setProfile({ ...profile, targetRoles: newRoles });
  };

  const handleLocationToggle = (location: string) => {
    const newLocations = profile.preferredLocations.includes(location)
      ? profile.preferredLocations.filter(l => l !== location)
      : [...profile.preferredLocations, location];
    setProfile({ ...profile, preferredLocations: newLocations });
  };

  const { user, isLoading } = useSession();

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "NW"

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f0f4f5" }}>
        {/* Left Sidebar */}
        <SideBar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-10 py-3 flex-shrink-0">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">Profile</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="pl-4">
                <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="text-right">
                    {isLoading ? (
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-medium text-gray-800">{user?.name || "Guest User"}</p>
                    )}
                  </div>
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">{userInitials}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl space-y-6"
            >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Your profile helps AI write better personalized emails.
            </p>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? 'default' : 'outline'}
            className="gap-2"
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Edit Profile'}
          </Button>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <Select
                  value={profile.currentStatus}
                  onValueChange={(v) => setProfile({ ...profile, currentStatus: v as any })}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="recent_grad">Recent Graduate</SelectItem>
                    <SelectItem value="employed">Employed (Looking)</SelectItem>
                    <SelectItem value="unemployed">Actively Searching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Experience Level</Label>
                <Select
                  value={profile.experienceLevel}
                  onValueChange={(v) => setProfile({ ...profile, experienceLevel: v as any })}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intern">Intern</SelectItem>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="mid">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Job Preferences
            </CardTitle>
            <CardDescription>
              What roles and locations are you targeting?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Roles</Label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.slice(0, 8).map(role => (
                  <Badge
                    key={role}
                    variant={profile.targetRoles.includes(role) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${
                      profile.targetRoles.includes(role) ? 'bg-primary' : 'hover:bg-muted'
                    } ${!isEditing && 'pointer-events-none'}`}
                    onClick={() => isEditing && handleRoleToggle(role)}
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preferred Locations</Label>
              <div className="flex flex-wrap gap-2">
                {availableLocations.slice(0, 6).map(location => (
                  <Badge
                    key={location}
                    variant={profile.preferredLocations.includes(location) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${
                      profile.preferredLocations.includes(location) ? 'bg-primary' : 'hover:bg-muted'
                    } ${!isEditing && 'pointer-events-none'}`}
                    onClick={() => isEditing && handleLocationToggle(location)}
                  >
                    {location}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              Skills & Tech Stack
            </CardTitle>
            <CardDescription>
              AI uses this to match you with companies and personalize emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {profile.techStack.map(skill => (
                <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                  {skill}
                  {isEditing && (
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
              {isEditing && (
                <div className="relative">
                  <Input
                    placeholder="+ Add skill"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill(skillInput)}
                    className="w-32 h-7 text-sm"
                    list="skills"
                  />
                  <datalist id="skills">
                    {techStackOptions.filter(t => !profile.techStack.includes(t)).map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Portfolio & Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </Label>
                <Input
                  value={profile.linkedinUrl || ''}
                  onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </Label>
                <Input
                  value={profile.githubUrl || ''}
                  onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
                  placeholder="https://github.com/..."
                  disabled={!isEditing}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Portfolio Website</Label>
              <Input
                value={profile.portfolioUrl || ''}
                onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.com"
                disabled={!isEditing}
              />
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              My Projects
            </CardTitle>
            <CardDescription>
              AI can reference these projects in your cold emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg border bg-muted/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{project.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.techStack.map(tech => (
                        <Badge key={tech} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                    {project.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {project.highlights.map((highlight, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="text-primary">•</span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {isEditing && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {project.url && (
                    <a href={project.url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                        <ExternalLink className="h-3 w-3" />
                        Live Demo
                      </Badge>
                    </a>
                  )}
                  {project.githubUrl && (
                    <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                        <Github className="h-3 w-3" />
                        GitHub
                      </Badge>
                    </a>
                  )}
                </div>
              </motion.div>
            ))}

            {isEditing && (
              <Button variant="outline" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Project
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
      </main>
    </div>
  </SidebarProvider>
  );
}
