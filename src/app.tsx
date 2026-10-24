import { useEffect, useState } from "react";
import {
  generateContent,
  type ContentFormat,
} from "./lib/generation";
import {
  ArrowDownRight,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Clock3,
  Command,
  FileText,
  Film,
  Image,
  Layers3,
  Lightbulb,
  Menu,
  MessageSquareText,
  Search,
  Settings2,
  Sparkles,
  WandSparkles,
  X,
  Trash2,
} from "lucide-react";

type Project = {
  id: string;
  title: string;
  category: ContentFormat;
  idea: string;
  updated: string;
  iconKey: "story" | "social" | "video" | "image";
  color: string;
  generatedContent?: string;
};

const STORAGE_KEY = "growthflow_projects_v1";

const formats: {
  name: ContentFormat;
  description: string;
  icon: typeof MessageSquareText;
}[] = [
  {
    name: "Social post",
    description: "Captions and posts",
    icon: MessageSquareText,
  },
  {
    name: "Story",
    description: "Narratives and scenes",
    icon: BookOpen,
  },
  {
    name: "Video script",
    description: "Short-form video",
    icon: Film,
  },
  {
    name: "Image concept",
    description: "Visual directions",
    icon: Image,
  },
];

const iconForFormat: Record<
  ContentFormat,
  Project["iconKey"]
> = {
  "Social post": "social",
  Story: "story",
  "Video script": "video",
  "Image concept": "image",
};

const initialProjects: Project[] = [
  {
    id: "sample-story",
    title: "The art of starting again",
    category: "Story",
    idea: "The art of starting again",
    updated: "Sample project",
    iconKey: "story",
    color: "violet",
  },
  {
    id: "sample-social",
    title: "Ideas that connect",
    category: "Social post",
    idea: "Ideas that connect",
    updated: "Sample project",
    iconKey: "social",
    color: "mint",
  },
  {
    id: "sample-video",
    title: "A day in the life",
    category: "Video script",
    idea: "A day in the life",
    updated: "Sample project",
    iconKey: "video",
    color: "blue",
  },
];

function readProjects(): Project[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialProjects;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return initialProjects;
    }

    return parsed.filter(
      (item): item is Project =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.idea === "string" &&
        typeof item.category === "string" &&
        formats.some((format) => format.name === item.category) &&
        typeof item.updated === "string" &&
        typeof item.iconKey === "string" &&
        ["story", "social", "video", "image"].includes(
          item.iconKey,
        ) &&
        typeof item.color === "string" &&
        (item.generatedContent === undefined ||
          typeof item.generatedContent === "string"),
    );
  } catch {
    return initialProjects;
  }
}

function App() {
  const [activeNav, setActiveNav] = useState("Workspace");
  const [format, setFormat] =
    useState<ContentFormat>("Social post");
  const [idea, setIdea] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generationModel, setGenerationModel] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [projects, setProjects] =
    useState<Project[]>(readProjects);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProjectId, setEditingProjectId] =
    useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(projects),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [projects]);

  const filteredProjects = projects.filter((project) =>
    project.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  function handleCreate() {
    const cleanIdea = idea.trim();

    if (!cleanIdea) {
      setResult("Enter an idea before saving your brief.");
      return;
    }

    const now = new Date().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

    if (editingProjectId) {
      setProjects((current) =>
        current.map((project) =>
          project.id === editingProjectId
            ? {
                ...project,
                title: cleanIdea.split("\n")[0].slice(0, 60),
                category: format,
                idea: cleanIdea,
                generatedContent:
                  project.idea === cleanIdea &&
                  project.category === format
                    ? project.generatedContent
                    : undefined,
                updated: `Edited ${now}`,
                iconKey: iconForFormat[format],
              }
            : project,
        ),
      );

      setResult("Your changes have been saved on this device.");
    } else {
      const newProject: Project = {
        id: crypto.randomUUID(),
        title: cleanIdea.split("\n")[0].slice(0, 60),
        category: format,
        idea: cleanIdea,
        updated: `Saved ${now}`,
        iconKey: iconForFormat[format],
        color:
          format === "Story"
            ? "violet"
            : format === "Video script"
              ? "blue"
              : format === "Image concept"
                ? "mint"
                : "violet",
      };

      setProjects((current) => [newProject, ...current]);
      setEditingProjectId(newProject.id);
      setResult("Your brief has been saved on this device.");
    }

    setActiveNav("Workspace");
  }

  function openProject(project: Project) {
    setEditingProjectId(project.id);
    setIdea(project.idea);
    setFormat(project.category);
    setGeneratedContent(project.generatedContent ?? "");
    setGenerationModel("");
    setGenerationError("");
    setResult("");
    setActiveNav("Workspace");
    setShowMobileNav(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNewBrief() {
    setEditingProjectId(null);
    setIdea("");
    setFormat("Social post");
    setGeneratedContent("");
    setGenerationModel("");
    setGenerationError("");
    setResult("");
    setActiveNav("Workspace");
  }

  async function handleGenerate() {
    const cleanIdea = idea.trim();

    if (!cleanIdea) {
      setGenerationError(
        "Enter an idea before generating content.",
      );
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setResult("");

    try {
      const response = await generateContent({
        idea: cleanIdea,
        format,
      });

      const now = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });

      setGeneratedContent(response.content);
      setGenerationModel(response.model);

      if (editingProjectId) {
        setProjects((current) =>
          current.map((project) =>
            project.id === editingProjectId
              ? {
                  ...project,
                  title: cleanIdea.split("\n")[0].slice(0, 60),
                  category: format,
                  idea: cleanIdea,
                  generatedContent: response.content,
                  updated: `Generated ${now}`,
                  iconKey: iconForFormat[format],
                }
              : project,
          ),
        );
      } else {
        const newProject: Project = {
          id: crypto.randomUUID(),
          title: cleanIdea.split("\n")[0].slice(0, 60),
          category: format,
          idea: cleanIdea,
          generatedContent: response.content,
          updated: `Generated ${now}`,
          iconKey: iconForFormat[format],
          color:
            format === "Story"
              ? "violet"
              : format === "Video script"
                ? "blue"
                : format === "Image concept"
                  ? "mint"
                  : "violet",
        };

        setProjects((current) => [newProject, ...current]);
        setEditingProjectId(newProject.id);
      }

      setResult(
        "Generated content and saved it with this brief on this device.",
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Content generation failed. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyGeneratedContent() {
    try {
      await navigator.clipboard.writeText(generatedContent);
      setResult("Generated content copied to clipboard.");
    } catch {
      setGenerationError(
        "Clipboard access is unavailable in this browser. Select the text and copy it manually.",
      );
    }
  }

  function deleteProject(project: Project) {
    const confirmed = window.confirm(
      `Delete "${project.title}" from this device? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setProjects((current) =>
      current.filter((item) => item.id !== project.id),
    );

    if (editingProjectId === project.id) {
      startNewBrief();
    }

    setResult("Project deleted from this device.");
  }

  function selectNav(name: string) {
    setActiveNav(name);
    setShowMobileNav(false);

    if (name === "Settings") {
      setShowSettings(true);
    }
  }

  return (
    <div className="app-shell">
      {showMobileNav && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setShowMobileNav(false)}
        />
      )}

      <aside
        className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}
      >
        <a
          className="brand"
          href="#workspace"
          aria-label="GrowthFlow home"
          onClick={(event) => {
            event.preventDefault();
            startNewBrief();
          }}
        >
          <span className="brand-mark">
            <Layers3 size={21} strokeWidth={2.2} />
          </span>

          <span className="brand-name">
            Growth<span>Flow</span>
          </span>

          <button
            className="icon-button mobile-close"
            aria-label="Close menu"
            onClick={(event) => {
              event.preventDefault();
              setShowMobileNav(false);
            }}
          >
            <X size={18} />
          </button>
        </a>

        <button
          className="workspace-switcher"
          onClick={() => setShowSettings(true)}
        >
          <span className="workspace-avatar">G</span>

          <span className="workspace-info">
            <strong>Creative Studio</strong>
            <span>Personal workspace</span>
          </span>

          <ChevronDown size={16} className="muted-icon" />
        </button>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="nav-list" aria-label="Main navigation">
          <button
            className={`nav-item ${
              activeNav === "Workspace" ? "active" : ""
            }`}
            onClick={() => selectNav("Workspace")}
          >
            <Layers3 size={18} />
            <span>Workspace</span>
          </button>

          <button
            className={`nav-item ${
              activeNav === "Discover" ? "active" : ""
            }`}
            onClick={() => selectNav("Discover")}
          >
            <Lightbulb size={18} />
            <span>Discover ideas</span>
            <span className="nav-new">NEW</span>
          </button>

          <button
            className={`nav-item ${
              activeNav === "Projects" ? "active" : ""
            }`}
            onClick={() => selectNav("Projects")}
          >
            <FileText size={18} />
            <span>My projects</span>
            <span className="nav-count">{projects.length}</span>
          </button>
        </nav>

        <div className="sidebar-label sidebar-label-spaced">
          CREATE
        </div>

        <nav className="nav-list" aria-label="Creation tools">
          <button
            className={`nav-item ${
              activeNav === "Stories" ? "active" : ""
            }`}
            onClick={() => {
              setFormat("Story");
              selectNav("Stories");
            }}
          >
            <BookOpen size={18} />
            <span>Story studio</span>
          </button>

          <button
            className={`nav-item ${
              activeNav === "Video" ? "active" : ""
            }`}
            onClick={() => {
              setFormat("Video script");
              selectNav("Video");
            }}
          >
            <Clapperboard size={18} />
            <span>Video studio</span>
          </button>

          <button
            className={`nav-item ${
              activeNav === "Visuals" ? "active" : ""
            }`}
            onClick={() => {
              setFormat("Image concept");
              selectNav("Visuals");
            }}
          >
            <Image size={18} />
            <span>Visual studio</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-help">
          <div className="help-icon">
            <CircleHelp size={19} />
          </div>

          <strong>Make something great.</strong>
          <p>Your next idea could be your best one yet.</p>

          <button
            className="help-link"
            onClick={() =>
              setResult(
                "Start with one clear idea. Choose a format, describe what you want to create, and save your brief.",
              )
            }
          >
            Explore the workspace <ArrowRight size={14} />
          </button>
        </div>

        <button
          className={`nav-item settings-nav ${
            showSettings ? "active" : ""
          }`}
          onClick={() => setShowSettings(true)}
        >
          <Settings2 size={18} />
          <span>Settings</span>
        </button>

        <div className="sidebar-footer">
          <div className="profile-avatar">A</div>

          <div className="profile-info">
            <strong>Studio owner</strong>
            <span>Free workspace</span>
          </div>

          <button
            className="icon-button"
            aria-label="Workspace settings"
            onClick={() => setShowSettings(true)}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </aside>

      <main className="main-panel" id="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setShowMobileNav(true)}
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>GrowthFlow</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{activeNav}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} />

              <input
                aria-label="Search projects"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />

              <span className="search-shortcut">
                <Command size={11} /> K
              </span>
            </div>

            <button
              className="icon-button topbar-settings"
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
            >
              <Settings2 size={18} />
            </button>

            <div className="profile-avatar top-avatar">A</div>
          </div>
        </header>

        <div className="content-area">
          {activeNav === "Discover" ? (
            <section className="secondary-page">
              <span className="eyebrow">
                <Lightbulb size={14} /> IDEA EXPLORER
              </span>

              <h1>Every great thing starts with an idea.</h1>

              <p className="page-subtitle">
                Choose a starting point, then turn it into something of
                your own.
              </p>

              <div className="idea-prompt-grid">
                {[
                  "Tell a story about an unexpected opportunity.",
                  "Create a post that makes people stop scrolling.",
                  "Write a short video about a lesson worth sharing.",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="suggestion-card"
                    onClick={() => {
                      setIdea(suggestion);
                      setEditingProjectId(null);
                      setActiveNav("Workspace");
                    }}
                  >
                    <Sparkles size={19} />
                    <span>{suggestion}</span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
            </section>
          ) : activeNav === "Projects" ? (
            <section className="secondary-page">
              <span className="eyebrow">
                <FileText size={14} /> YOUR LIBRARY
              </span>

              <h1>My projects</h1>

              <p className="page-subtitle">
                Your saved creative briefs, stored on this device.
              </p>

              <button
                className="primary-button"
                onClick={startNewBrief}
              >
                New brief <ArrowRight size={16} />
              </button>

              <ProjectGrid
                projects={filteredProjects}
                onOpen={openProject}
                onDelete={deleteProject}
              />
            </section>
          ) : activeNav === "Stories" ||
            activeNav === "Video" ||
            activeNav === "Visuals" ? (
            <section className="secondary-page">
              <span className="eyebrow">
                <WandSparkles size={14} /> CREATIVE STUDIO
              </span>

              <h1>
                {activeNav === "Stories"
                  ? "Story studio"
                  : activeNav === "Video"
                    ? "Video studio"
                    : "Visual studio"}
              </h1>

              <p className="page-subtitle">
                Start with a brief. Shape your idea into a creative
                direction.
              </p>

              <button
                className="primary-button"
                onClick={() => setActiveNav("Workspace")}
              >
                Start creating <ArrowRight size={16} />
              </button>
            </section>
          ) : (
            <>
              <section className="welcome-section">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-dot" />
                    YOUR CREATIVE WORKSPACE
                  </div>

                  <h1>
                    Ideas become{" "}
                    <span className="gradient-text">something.</span>
                  </h1>

                  <p className="welcome-description">
                    Think it. Shape it. Bring it to life.
                    <br className="desktop-break" /> Your creative
                    process starts here.
                  </p>
                </div>

                <div className="welcome-art" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />

                  <div className="art-core">
                    <Sparkles size={31} strokeWidth={1.4} />
                  </div>

                  <span className="art-star star-one">✳</span>
                  <span className="art-star star-two">✦</span>
                  <span className="art-star star-three">·</span>
                </div>
              </section>

              <section className="composer-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      {editingProjectId
                        ? "Continue your brief"
                        : "What are we creating today?"}
                    </h2>

                    <p>
                      {editingProjectId
                        ? "Update your idea and save your changes."
                        : "Start with an idea. You can refine it as you go."}
                    </p>
                  </div>

                  <span className="step-indicator">
                    01 <span>/ 03</span>
                  </span>
                </div>

                <div className="composer-card">
                  <label className="field-label" htmlFor="idea-input">
                    YOUR STARTING IDEA
                  </label>

                  <textarea
                    id="idea-input"
                    value={idea}
                    onChange={(event) => {
                      setIdea(event.target.value);
                      setResult("");
                      setGenerationError("");
                      setGeneratedContent("");
                      setGenerationModel("");
                    }}
                    placeholder="Describe what you want to create, who it's for, and what you want it to achieve..."
                    rows={4}
                    maxLength={10000}
                  />

                  <div className="composer-bottom">
                    <span className="input-hint">
                      <Sparkles size={14} /> A rough idea is enough to
                      begin.
                    </span>

                    <span className="character-count">
                      {idea.length} / 10000
                    </span>
                  </div>

                  <div className="composer-divider" />

                  <div className="format-heading">
                    <div>
                      <span className="field-label">
                        CHOOSE YOUR FORMAT
                      </span>
                      <span className="format-subtitle">
                        What should this become?
                      </span>
                    </div>
                  </div>

                  <div className="format-grid">
                    {formats.map((item) => {
                      const FormatIcon = item.icon;
                      const selected = format === item.name;

                      return (
                        <button
                          key={item.name}
                          className={`format-option ${
                            selected ? "format-selected" : ""
                          }`}
                          onClick={() => {
                            setFormat(item.name);
                            setGeneratedContent("");
                            setGenerationModel("");
                            setGenerationError("");
                          }}
                          aria-pressed={selected}
                        >
                          <span className="format-icon">
                            <FormatIcon size={19} />
                          </span>

                          <span className="format-copy">
                            <strong>{item.name}</strong>
                            <small>{item.description}</small>
                          </span>

                          <span className="format-check">
                            {selected && <Check size={13} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="composer-actions">
                    <span className="privacy-note">
                      <Settings2 size={14} /> Saved on this device.
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="text-button"
                        onClick={handleGenerate}
                        disabled={!idea.trim() || isGenerating}
                      >
                        <Sparkles size={15} />
                        {isGenerating
                          ? "Generating..."
                          : "Generate content"}
                      </button>

                      {editingProjectId && (
                        <button
                          className="text-button"
                          onClick={startNewBrief}
                        >
                          Cancel edit
                        </button>
                      )}

                      <button
                        className="primary-button"
                        onClick={handleCreate}
                        disabled={!idea.trim()}
                      >
                        {editingProjectId
                          ? "Save changes"
                          : "Save brief"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {isGenerating && (
                  <div className="result-notice" role="status">
                    <span className="result-icon">
                      <Sparkles size={17} />
                    </span>

                    <div>
                      <strong>Creating your content</strong>
                      <p>
                        GrowthFlow is waiting for the generation service
                        to respond. This can take a little while.
                      </p>
                    </div>
                  </div>
                )}

                {generationError && (
                  <div
                    className="result-notice generation-error"
                    role="alert"
                  >
                    <div>
                      <strong>Generation could not complete</strong>
                      <p>{generationError}</p>
                    </div>

                    <button
                      className="icon-button"
                      aria-label="Dismiss generation error"
                      onClick={() => setGenerationError("")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {generatedContent && (
                  <section
                    className="generated-output"
                    aria-labelledby="generated-output-title"
                  >
                    <div className="generated-output-heading">
                      <div>
                        <span className="eyebrow">
                          <Sparkles size={14} /> GENERATED RESULT
                        </span>

                        <h2 id="generated-output-title">
                          Your content
                        </h2>

                        <p>
                          {generationModel
                            ? `Model: ${generationModel}`
                            : "Saved with this brief on this device."}
                        </p>
                      </div>

                      <button
                        className="text-button"
                        onClick={copyGeneratedContent}
                      >
                        <FileText size={15} /> Copy text
                      </button>
                    </div>

                    <div className="generated-output-content">
                      {generatedContent}
                    </div>
                  </section>
                )}

                {storageError && (
                  <div className="result-notice" role="alert">
                    <div>
                      <strong>Could not save projects</strong>
                      <p>
                        Browser storage may be unavailable or full. Your
                        latest changes may not persist after leaving
                        this page.
                      </p>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="result-notice" role="status">
                    <span className="result-icon">
                      <Check size={17} />
                    </span>

                    <div>
                      <strong>Workspace update</strong>
                      <p>{result}</p>
                    </div>

                    <button
                      className="icon-button"
                      aria-label="Dismiss message"
                      onClick={() => setResult("")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </section>

              <section className="projects-section">
                <div className="section-heading project-heading">
                  <div>
                    <h2>Pick up where you left off</h2>
                    <p>
                      Your saved creative briefs, ready when you are.
                    </p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActiveNav("Projects")}
                  >
                    View all <ArrowRight size={15} />
                  </button>
                </div>

                <ProjectGrid
                  projects={filteredProjects.slice(0, 3)}
                  onOpen={openProject}
                  onDelete={deleteProject}
                />
              </section>

              <section className="bottom-note">
                <div className="bottom-note-icon">
                  <AudioLines size={17} />
                </div>

                <div>
                  <strong>Your ideas deserve a good workflow.</strong>
                  <p>
                    Start small, find your direction, and build something
                    worth sharing.
                  </p>
                </div>

                <ArrowDownRight
                  size={20}
                  className="bottom-note-arrow"
                />
              </section>
            </>
          )}

          <footer className="page-footer">
            <span>
              GrowthFlow <span className="footer-dot">·</span> Creative
              intelligence
            </span>

            <span>Built for ideas in motion.</span>
          </footer>
        </div>
      </main>

      {showSettings && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">WORKSPACE</span>
                <h2 id="settings-title">Settings</h2>
              </div>

              <button
                className="icon-button"
                aria-label="Close settings"
                onClick={() => setShowSettings(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="settings-row">
              <span className="settings-row-icon">
                <Layers3 size={18} />
              </span>

              <div>
                <strong>Creative Studio</strong>
                <p>Your personal GrowthFlow workspace.</p>
              </div>
            </div>

            <div className="settings-row">
              <span className="settings-row-icon">
                <Sparkles size={18} />
              </span>

              <div>
                <strong>AI provider</strong>
                <p>
                  No provider connected yet. AI generation is not
                  active.
                </p>
              </div>

              <span className="connection-status">
                Not connected
              </span>
            </div>

            <div className="settings-row">
              <span className="settings-row-icon">
                <Clock3 size={18} />
              </span>

              <div>
                <strong>Project storage</strong>
                <p>
                  {projects.length} project(s) stored in this browser.
                </p>
              </div>
            </div>

            <button
              className="primary-button modal-done"
              onClick={() => setShowSettings(false)}
            >
              Done <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function ProjectGrid({
  projects,
  onOpen,
  onDelete,
}: {
  projects: Project[];
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <Search size={23} />
        <strong>No matching projects</strong>
        <p>Try another search, or create a new brief.</p>
      </div>
    );
  }

  return (
    <div className="project-grid">
      {projects.map((project, index) => {
        const ProjectIcon =
          project.iconKey === "story"
            ? BookOpen
            : project.iconKey === "video"
              ? Clapperboard
              : project.iconKey === "image"
                ? Image
                : MessageSquareText;

        return (
          <article className="project-card" key={project.id}>
            <button
              className={`project-preview preview-${project.color}`}
              onClick={() => onOpen(project)}
              aria-label={`Open ${project.title}`}
              style={{
                width: "100%",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span className="preview-topline">
                <span className="preview-brand">
                  <Layers3 size={13} /> GF / STUDIO
                </span>

                <span className="preview-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>

              <span className="preview-artwork">
                <span className="preview-ring ring-large" />
                <span className="preview-ring ring-small" />

                <span className="preview-symbol">
                  <ProjectIcon size={27} strokeWidth={1.5} />
                </span>
              </span>

              <span className="preview-category">
                {project.category}
              </span>
            </button>

            <div className="project-card-content">
              <button
                onClick={() => onOpen(project)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  textAlign: "left",
                  color: "inherit",
                  cursor: "pointer",
                }}
                aria-label={`Edit ${project.title}`}
              >
                <h3>{project.title}</h3>
                <p>
                  <Clock3 size={12} /> {project.updated}
                </p>
              </button>

              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  className="project-open"
                  aria-label={`Open ${project.title}`}
                  onClick={() => onOpen(project)}
                >
                  <ArrowRight size={16} />
                </button>

                <button
                  className="project-open"
                  aria-label={`Delete ${project.title}`}
                  title="Delete project"
                  onClick={() => onDelete(project)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default App;
