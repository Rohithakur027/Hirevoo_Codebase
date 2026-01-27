"use client"

import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Edit2, Trash2, Copy, SlidersHorizontal } from 'lucide-react';
import { SidebarProvider } from "@/context/SidebarContext";
import { SideBar } from "@/components/layout";
import { BottomNav } from "@/components/layout/BottomNav";
import { useSession } from "../hooks/use-session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Type definitions
interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'Cold Outreach' | 'Follow-up' | 'Networking' | 'Referral';
  tone: 'Professional' | 'Friendly' | 'Urgent';
  length: 'Short' | 'Medium' | 'Long';
  is_system: boolean;
}

// Mock data
const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Software Engineer Cold Outreach',
    subject: 'Quick question regarding {company}',
    body: 'Hi {firstName},\n\nI came across {company} and was impressed by your work on {product}. I\'m a software engineer specializing in {skill}, and I\'d love to connect and learn more about your team\'s approach to {topic}.\n\nWould you be open to a brief call next week?\n\nBest,\n{yourName}',
    category: 'Cold Outreach',
    tone: 'Professional',
    length: 'Medium',
    is_system: true
  },
  {
    id: '2',
    name: 'Follow-up After Interview',
    subject: 'Thank you for the opportunity',
    body: 'Dear {interviewerName},\n\nThank you for taking the time to speak with me about the {position} role at {company}. I enjoyed learning more about the team and the exciting projects you\'re working on.\n\nI\'m very enthusiastic about the opportunity and believe my experience in {skills} would be a great fit.\n\nLooking forward to hearing from you.\n\nBest regards,\n{yourName}',
    category: 'Follow-up',
    tone: 'Professional',
    length: 'Short',
    is_system: true
  },
  {
    id: '3',
    name: 'LinkedIn Networking Request',
    subject: 'Connecting on LinkedIn',
    body: 'Hi {firstName},\n\nI noticed we both work in {industry} and share an interest in {topic}. I\'d love to connect and exchange ideas about {subject}.\n\nCheers,\n{yourName}',
    category: 'Networking',
    tone: 'Friendly',
    length: 'Short',
    is_system: true
  },
  {
    id: '4',
    name: 'Referral Demo Request',
    subject: 'Let\'s explore how {product} can help {company}',
    body: 'Hi {firstName},\n\nI wanted to reach out because I believe {product} could significantly improve {painPoint} at {company}.\n\nWe\'ve helped companies like {competitor} achieve {result}. Would you be interested in a 15-minute demo to see how we can help you?\n\nBest,\n{yourName}',
    category: 'Referral',
    tone: 'Professional',
    length: 'Medium',
    is_system: true
  },
  {
    id: '5',
    name: 'Urgent Follow-up on Proposal',
    subject: 'Quick follow-up on our proposal',
    body: 'Hi {firstName},\n\nI wanted to quickly follow up on the proposal I sent last week. Do you have any questions or need additional information?\n\nHappy to jump on a call if that would be helpful.\n\nThanks,\n{yourName}',
    category: 'Follow-up',
    tone: 'Urgent',
    length: 'Short',
    is_system: false
  },
  {
    id: '6',
    name: 'Product Launch Announcement',
    subject: 'Exciting news from {company}',
    body: 'Hi {firstName},\n\nI\'m thrilled to share that we just launched {product}! This has been months in the making, and I think you\'ll find it valuable for {useCase}.\n\nKey features include:\n- {feature1}\n- {feature2}\n- {feature3}\n\nWould love to show you a quick demo. Are you available this week?\n\nBest,\n{yourName}',
    category: 'Referral',
    tone: 'Friendly',
    length: 'Long',
    is_system: false
  },
  {
    id: '7',
    name: 'Conference Networking',
    subject: 'Great meeting you at {conference}',
    body: 'Hey {firstName},\n\nIt was great meeting you at {conference} yesterday! I really enjoyed our conversation about {topic}.\n\nI\'d love to stay in touch. Let me know if you\'d like to grab coffee sometime.\n\nCheers,\n{yourName}',
    category: 'Networking',
    tone: 'Friendly',
    length: 'Short',
    is_system: false
  },
  {
    id: '8',
    name: 'Cold Outreach to Investor',
    subject: 'Introduction to {startup}',
    body: 'Dear {investorName},\n\nI\'m reaching out to introduce {startup}, a company that\'s building {solution} for {market}.\n\nWe\'ve achieved {traction} in the past {timeframe} and are currently raising a {round} round. Given your investment in {portfolio}, I thought this might be of interest.\n\nWould you be open to a brief call to discuss?\n\nBest regards,\n{yourName}',
    category: 'Cold Outreach',
    tone: 'Professional',
    length: 'Medium',
    is_system: true
  }
];

const EmailTemplatesDashboard = () => {
  const { user, isLoading } = useSession();
  const [activeTab, setActiveTab] = useState<'gallery' | 'my-templates'>('gallery');

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "NW";
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  const [selectedLengths, setSelectedLengths] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentViewTemplateIndex, setCurrentViewTemplateIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  // Temporary state for the filter drawer
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempTones, setTempTones] = useState<string[]>([]);
  const [tempLengths, setTempLengths] = useState<string[]>([]);

  const openFilterDrawer = () => {
    setTempCategories([...selectedCategories]);
    setTempTones([...selectedTones]);
    setTempLengths([...selectedLengths]);
    setIsFilterDrawerOpen(true);
  };

  const applyFilters = () => {
    setSelectedCategories(tempCategories);
    setSelectedTones(tempTones);
    setSelectedLengths(tempLengths);
    setIsFilterDrawerOpen(false);
  };

  const clearTempFilters = () => {
    setTempCategories([]);
    setTempTones([]);
    setTempLengths([]);
  };

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'Cold Outreach' as Template['category'],
    tone: 'Professional' as Template['tone'],
    length: 'Medium' as Template['length']
  });

  const categories = ['Cold Outreach', 'Follow-up', 'Networking', 'Referral'];
  const tones = ['Professional', 'Friendly', 'Urgent'];
  const lengths = ['Short', 'Medium', 'Long'];

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return mockTemplates.filter(template => {
      const matchesTab = activeTab === 'gallery' ? template.is_system : !template.is_system;
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.body.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(template.category);
      const matchesTone = selectedTones.length === 0 || selectedTones.includes(template.tone);
      const matchesLength = selectedLengths.length === 0 || selectedLengths.includes(template.length);

      return matchesTab && matchesSearch && matchesCategory && matchesTone && matchesLength;
    });
  }, [activeTab, searchQuery, selectedCategories, selectedTones, selectedLengths]);

  const toggleFilter = (filterArray: string[], setFilterArray: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    if (filterArray.includes(value)) {
      setFilterArray(filterArray.filter(item => item !== value));
    } else {
      setFilterArray([...filterArray, value]);
    }
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedTones([]);
    setSelectedLengths([]);
    setSearchQuery('');
  };

  const handleCreateTemplate = () => {
    if (isEditing && editingTemplateId) {
      // Update existing template
      const templateIndex = mockTemplates.findIndex(t => t.id === editingTemplateId);
      if (templateIndex !== -1) {
        mockTemplates[templateIndex] = {
          ...mockTemplates[templateIndex],
          name: newTemplate.name,
          subject: newTemplate.subject,
          body: newTemplate.body,
          category: newTemplate.category,
          tone: newTemplate.tone,
          length: newTemplate.length
        };
      }
    } else {
      // Create new template
      const template: Template = {
        id: Date.now().toString(),
        name: newTemplate.name,
        subject: newTemplate.subject,
        body: newTemplate.body,
        category: newTemplate.category,
        tone: newTemplate.tone,
        length: newTemplate.length,
        is_system: false
      };

      mockTemplates.push(template);
      setActiveTab('my-templates');
    }

    setIsCreateModalOpen(false);
    setIsEditing(false);
    setEditingTemplateId(null);

    // Reset form
    setNewTemplate({
      name: '',
      subject: '',
      body: '',
      category: 'Cold Outreach',
      tone: 'Professional',
      length: 'Medium'
    });
  };

  const handleViewTemplate = (templateId: string) => {
    const index = filteredTemplates.findIndex(template => template.id === templateId);
    if (index !== -1) {
      setCurrentViewTemplateIndex(index);
      setIsViewModalOpen(true);
    }
  };

  const handlePrevTemplate = () => {
    setCurrentViewTemplateIndex(prev =>
      prev > 0 ? prev - 1 : filteredTemplates.length - 1
    );
  };

  const handleNextTemplate = () => {
    setCurrentViewTemplateIndex(prev =>
      prev < filteredTemplates.length - 1 ? prev + 1 : 0
    );
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast here
  };

  const handleEditTemplate = (templateId: string) => {
    const template = mockTemplates.find(t => t.id === templateId);
    if (template && !template.is_system) {
      setNewTemplate({
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        tone: template.tone,
        length: template.length
      });
      setIsEditing(true);
      setEditingTemplateId(templateId);
      setIsCreateModalOpen(true);
    }
  };

  const handleUseTemplate = (template: Template) => {
    setIsViewModalOpen(false);
    setNewTemplate({
      name: `${template.name} (Copy)`,
      subject: template.subject,
      body: template.body,
      category: template.category,
      tone: template.tone,
      length: template.length
    });
    setIsCreateModalOpen(true);
    setIsEditing(false);
    setEditingTemplateId(null);
  };



  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Cold Outreach': 'bg-blue-100 text-blue-700',
      'Follow-up': 'bg-purple-100 text-purple-700',
      'Networking': 'bg-green-100 text-green-700',
      'Referral': 'bg-orange-100 text-orange-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden pb-[60px] md:pb-0">
        {/* Left Sidebar */}
        <div className="hidden md:block">
          <SideBar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - Fixed */}
          <div className="flex-shrink-0 bg-gray-50 z-10">
            <div className="px-6 py-6 pb-0">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold md:font-semibold text-gray-900">Email Templates</h1>
                <div className="flex items-center gap-4">

                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center justify-between border-b border-gray-200">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'gallery'
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Template Gallery
                    {activeTab === 'gallery' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('my-templates')}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'my-templates'
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    My Templates
                    {activeTab === 'my-templates' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                    )}
                  </button>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-[6px] hover:bg-gray-800 transition-colors font-medium text-sm mb-2"
                >
                  <Plus className="w-4 h-4" />
                  Create New Template
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
            <div className="max-w-[1600px] mx-auto">
              {/* Mobile: Create Button, Search, Filters */}
              <div className="md:hidden pb-4 space-y-4">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-[6px] hover:bg-gray-800 transition-colors font-medium text-base shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Create New Template
                </button>

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 text-sm border border-gray-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white shadow-sm"
                    />
                  </div>
                  <button
                    onClick={() => setIsFilterDrawerOpen(true)}
                    className="flex items-center justify-center w-12 bg-white border border-gray-200 rounded-[6px] text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                  </button>
                </div>

              </div>

              <div className="flex gap-6 items-start">
                {/* Sidebar Filters - Sticky within scroll container (Desktop Only) */}
                <aside className="hidden md:block w-64 flex-shrink-0 sticky top-0">
                  <div className="bg-white rounded-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900 text-sm">Filters</h2>
                      {(selectedCategories.length > 0 || selectedTones.length > 0 || selectedLengths.length > 0) && (
                        <button
                          onClick={resetFilters}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Search */}
                    <div className="mb-6">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Category Filter */}
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Category</h3>
                      <div className="space-y-2">
                        {categories.map(category => (
                          <label key={category} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category)}
                              onChange={() => toggleFilter(selectedCategories, setSelectedCategories, category)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">{category}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Tone Filter */}
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Tone</h3>
                      <div className="space-y-2">
                        {tones.map(tone => (
                          <label key={tone} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedTones.includes(tone)}
                              onChange={() => toggleFilter(selectedTones, setSelectedTones, tone)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">{tone}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Length Filter */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Length</h3>
                      <div className="space-y-2">
                        {lengths.map(length => (
                          <label key={length} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedLengths.includes(length)}
                              onChange={() => toggleFilter(selectedLengths, setSelectedLengths, length)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">{length}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                  {filteredTemplates.length === 0 ? (
                    <div className="bg-white rounded-sm border border-gray-200 p-12 text-center">
                      <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
                        <p className="text-gray-500 text-sm mb-6">
                          Try adjusting your search or filters to find what you're looking for.
                        </p>
                        <button
                          onClick={resetFilters}
                          className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTemplates.map(template => (
                        <div
                          key={template.id}
                          className="bg-white rounded-[12px] md:rounded-sm border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group flex flex-col h-full"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <h3 className="font-bold text-gray-900 text-base leading-tight flex-1">
                              {template.name}
                            </h3>
                            <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase whitespace-nowrap ${getCategoryColor(template.category)}`}>
                              {template.category}
                            </span>
                          </div>

                          {/* Subject */}
                          <p className="text-xs text-gray-500 mb-2 font-medium">
                            Subject: {truncateText(template.subject, 40)}
                          </p>

                          {/* Body Preview */}
                          <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed flex-1">
                            {truncateText(template.body, 100)}
                          </p>

                          {/* Metadata - Badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-6">
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-semibold border border-gray-200">
                              {template.tone}
                            </span>
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-semibold border border-gray-200">
                              {template.length}
                            </span>
                          </div>

                          {/* Footer Actions */}
                          <div className="flex items-center gap-3 pt-0 mt-auto">
                            {activeTab === 'gallery' ? (
                              <>
                                <button
                                  onClick={() => handleViewTemplate(template.id)}
                                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-[8px] hover:bg-gray-800 transition-colors text-sm font-bold"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleUseTemplate(template)}
                                  className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-[8px] hover:bg-gray-50 transition-colors text-sm font-bold shadow-sm whitespace-nowrap"
                                >
                                  Save Template
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleViewTemplate(template.id)}
                                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-[8px] hover:bg-gray-800 transition-colors text-sm font-bold"
                                >
                                  View
                                </button>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditTemplate(template.id)}
                                    className="p-2.5 text-gray-500 border border-gray-200 hover:text-gray-700 hover:bg-gray-50 rounded-[8px] transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button className="p-2.5 text-red-500 border border-gray-200 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </main>
              </div>
            </div>
          </div>
        </div>
        <BottomNav />
      </div >

      {/* Create Template Modal */}
      {
        isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-sm shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditing ? 'Update Template' : 'Create New Template'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditing(false);
                    setEditingTemplateId(null);
                    setNewTemplate({
                      name: '',
                      subject: '',
                      body: '',
                      category: 'Cold Outreach',
                      tone: 'Professional',
                      length: 'Medium'
                    });
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="e.g., Software Engineer Cold Outreach"
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                {/* Subject Line */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    placeholder="e.g., Quick question regarding {company}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{'}placeholders{'}'} for dynamic content
                  </p>
                </div>

                {/* Email Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body *
                  </label>
                  <textarea
                    value={newTemplate.body}
                    onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                    placeholder="Hi {firstName},&#10;&#10;Your email content here...&#10;&#10;Best,&#10;{yourName}"
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none font-mono text-sm"
                  />
                </div>

                {/* Category, Tone, Length - Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={newTemplate.category}
                      onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value as Template['category'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tone *
                    </label>
                    <select
                      value={newTemplate.tone}
                      onChange={(e) => setNewTemplate({ ...newTemplate, tone: e.target.value as Template['tone'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      {tones.map(tone => (
                        <option key={tone} value={tone}>{tone}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Length *
                    </label>
                    <select
                      value={newTemplate.length}
                      onChange={(e) => setNewTemplate({ ...newTemplate, length: e.target.value as Template['length'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      {lengths.map(len => (
                        <option key={len} value={len}>{len}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditing(false);
                    setEditingTemplateId(null);
                    setNewTemplate({
                      name: '',
                      subject: '',
                      body: '',
                      category: 'Cold Outreach',
                      tone: 'Professional',
                      length: 'Medium'
                    });
                  }}
                  className="px-2 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplate.name || !newTemplate.subject || !newTemplate.body}
                  className="px-2 py-2 text-sm font-medium text-white bg-gray-900 rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* View Full Template Modal */}
      {
        isViewModalOpen && filteredTemplates[currentViewTemplateIndex] && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-sm shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePrevTemplate}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-500">
                    {currentViewTemplateIndex + 1} / {filteredTemplates.length}
                  </span>
                  <button
                    onClick={handleNextTemplate}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {(() => {
                  const template = filteredTemplates[currentViewTemplateIndex];
                  return (
                    <div className="space-y-6">
                      {/* Template Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            {template.name}
                          </h2>
                          <span className={`inline-flex items-center px-3 py-1 rounded-sm text-sm font-medium ${getCategoryColor(template.category)}`}>
                            {template.category}
                          </span>
                        </div>
                        <div className="flex gap-2 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded-sm">
                            {template.tone}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 rounded-sm">
                            {template.length}
                          </span>
                        </div>
                      </div>

                      {/* Subject Line */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Subject Line</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                          <p className="text-gray-900">{template.subject}</p>
                        </div>
                      </div>

                      {/* Email Body */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Email Body</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                          <pre className="text-gray-900 whitespace-pre-wrap font-sans">{template.body}</pre>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => handleCopyToClipboard(filteredTemplates[currentViewTemplateIndex]?.body)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
                >
                  Use this Template
                </button>
                <button
                  onClick={() => handleUseTemplate(filteredTemplates[currentViewTemplateIndex])}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-sm hover:bg-gray-800 transition-colors"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Mobile Filter Drawer */}
      {
        isFilterDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 transition-opacity"
              onClick={() => setIsFilterDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative w-full bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-gray-900">Filter Templates</h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Categories */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleFilter(tempCategories, setTempCategories, cat)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${tempCategories.includes(cat)
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Tone</h3>
                  <div className="flex flex-wrap gap-2">
                    {tones.map(tone => (
                      <button
                        key={tone}
                        onClick={() => toggleFilter(tempTones, setTempTones, tone)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${tempTones.includes(tone)
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200"
                          }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Length</h3>
                  <div className="flex flex-wrap gap-2">
                    {lengths.map(len => (
                      <button
                        key={len}
                        onClick={() => toggleFilter(tempLengths, setTempLengths, len)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${tempLengths.includes(len)
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200"
                          }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
                <button
                  onClick={clearTempFilters}
                  className="text-sm font-medium text-gray-500 hover:text-gray-900"
                >
                  Clear All
                </button>
                <button
                  onClick={applyFilters}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-gray-900/20 active:scale-[0.98] transition-transform"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )
      }
    </SidebarProvider >
  );
};

export default EmailTemplatesDashboard;