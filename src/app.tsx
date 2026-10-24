import { useState } from "react";
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
} from "lucide-react";

type ContentFormat = "Social post" | "Story" | "Video script" | "Image concept";

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

const initialProjects = [
  {
    title: "The art of starting again",
    category: "Story",
    updated: "Edited recently",
    icon: BookOpen,
    color: "violet",
  },
  {
    title: "Ideas that connect",
    category: "Social post",
    updated: "Draft",
    icon: MessageSquareText,
    color: "mint",
  },
  {
    title: "A day in the life",
    category: "Video script",
    updated: "Draft",
    icon: Clapperboard,
    color: "blue",
  },
];

function App() {
  const [activeNav, setActiveNav] = useState("Workspace");
  const [format, setFormat] = useState<ContentFormat>("Social post");
  const [idea, setIdea] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState("");
  const [projects, setProjects] = useState(initialProjects);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  function handleCreate() {
    if (!idea.trim()) {
      setResult("");
      return;
    }

    const newProject = {
      title: idea.trim().slice(0, 60),
      category: format,
      updated: "Just now",
      icon: formats.find((item) => item.name === format)?.icon ?? FileText,
      color: "violet",
    };

    setProjects((current) => [newProject, ...current]);
    setResult(
      `Your ${format.toLowerCase()} brief is ready to develop. Your idea has been added to recent projects. AI generation will become available when a provider is connected securely.`,
    );
    setActiveNav("Workspace");
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

      <aside className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#workspace" aria-label="GrowthFlow home">
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
            className={`nav-item ${activeNav === "Workspace" ? "active" : ""}`}
            onClick={() => selectNav("Workspace")}
          >
            <Layers3 size={18} />
            <span>Workspace</span>
          </button>
          <button
            className={`nav-item ${activeNav === "Discover" ? "active" : ""}`}
            onClick={() => selectNav("Discover")}
          >
            <Lightbulb size={18} />
            <span>Discover ideas</span>
            <span className="nav-new">NEW</span>
          </button>
          <button
            className={`nav-item ${activeNav === "Projects" ? "active" : ""}`}
            onClick={() => selectNav("Projects")}
          >
            <FileText size={18} />
            <span>My projects</span>
            <span className="nav-count">{projects.length}</span>
          </button>
        </nav>

        <div className="sidebar-label sidebar-label-spaced">CREATE</div>

        <nav className="nav-list" aria-label="Creation tools">
          <button
            className={`nav-item ${activeNav === "Stories" ? "active" : ""}`}
            onClick={() => {
              setFormat("Story");
              selectNav("Stories");
            }}
          >
            <BookOpen size={18} />
            <span>Story studio</span>
          </button>
          <button
            className={`nav-item ${activeNav === "Video" ? "active" : ""}`}
            onClick={() => {
              setFormat("Video script");
              selectNav("Video");
            }}
          >
            <Clapperboard size={18} />
            <span>Video studio</span>
          </button>
          <button
            className={`nav-item ${activeNav === "Visuals" ? "active" : ""}`}
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
            onClick={() => setResult("Start with one clear idea. Choose a format, describe what you want to create, and save your brief to your workspace.")}
          >
            Explore the workspace <ArrowRight size={14} />
          </button>
        </div>

        <button
          className={`nav-item settings-nav ${showSettings ? "active" : ""}`}
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
                onChange={(event) => setSearchTerm(event.target.value)}
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
              <span className="eyebrow"><Lightbulb size={14} /> IDEA EXPLORER</span>
              <h1>Every great thing starts with an idea.</h1>
              <p className="page-subtitle">Choose a starting point, then turn it into something of your own.</p>
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
              <span className="eyebrow"><FileText size={14} /> YOUR LIBRARY</span>
              <h1>My projects</h1>
              <p className="page-subtitle">Your saved creative briefs, all in one place.</p>
              <ProjectGrid projects={filteredProjects} />
            </section>
          ) : activeNav === "Stories" || activeNav === "Video" || activeNav === "Visuals" ? (
            <section className="secondary-page">
              <span className="eyebrow"><WandSparkles size={14} /> CREATIVE STUDIO</span>
              <h1>{activeNav === "Stories" ? "Story studio" : activeNav === "Video" ? "Video studio" : "Visual studio"}</h1>
              <p className="page-subtitle">Start with a brief. Shape your idea into a creative direction.</p>
              <button className="primary-button" onClick={() => setActiveNav("Workspace")}>
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
                    Ideas become <span className="gradient-text">something.</span>
                  </h1>
                  <p className="welcome-description">
                    Think it. Shape it. Bring it to life.
                    <br className="desktop-break" /> Your creative process starts here.
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
                    <h2>What are we creating today?</h2>
                    <p>Start with an idea. You can refine it as you go.</p>
                  </div>
                  <span className="step-indicator">01 <span>/ 03</span></span>
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
                    }}
                    placeholder="Describe what you want to create, who it's for, and what you want it to achieve..."
                    rows={4}
                  />
                  <div className="composer-bottom">
                    <span className="input-hint">
                      <Sparkles size={14} /> A rough idea is enough to begin.
                    </span>
                    <span className="character-count">{idea.length} / 1000</span>
                  </div>

                  <div className="composer-divider" />

                  <div className="format-heading">
                    <div>
                      <span className="field-label">CHOOSE YOUR FORMAT</span>
                      <span className="format-subtitle">What should this become?</span>
                    </div>
                  </div>

                  <div className="format-grid">
                    {formats.map((item) => {
                      const FormatIcon = item.icon;
                      const selected = format === item.name;

                      return (
                        <button
                          key={item.name}
                          className={`format-option ${selected ? "format-selected" : ""}`}
                          onClick={() => setFormat(item.name)}
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
                      <Settings2 size={14} /> Your workspace, your ideas.
                    </span>
                    <button
                      className="primary-button"
                      onClick={handleCreate}
                      disabled={!idea.trim()}
                    >
                      Create brief <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                {result && (
                  <div className="result-notice" role="status">
                    <span className="result-icon"><Check size={17} /></span>
                    <div>
                      <strong>Brief saved to your workspace</strong>
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
                    <p>Your creative work, ready when you are.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActiveNav("Projects")}
                  >
                    View all <ArrowRight size={15} />
                  </button>
                </div>
                <ProjectGrid projects={filteredProjects.slice(0, 3)} />
              </section>

              <section className="bottom-note">
                <div className="bottom-note-icon"><AudioLines size={17} /></div>
                <div>
                  <strong>Your ideas deserve a good workflow.</strong>
                  <p>Start small, find your direction, and build something worth sharing.</p>
                </div>
                <ArrowDownRight size={20} className="bottom-note-arrow" />
              </section>
            </>
          )}

          <footer className="page-footer">
            <span>GrowthFlow <span className="footer-dot">·</span> Creative intelligence</span>
            <span>Built for ideas in motion.</span>
          </footer>
        </div>
      </main>

      {showSettings && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSettings(false);
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
              <span className="settings-row-icon"><Layers3 size={18} /></span>
              <div>
                <strong>Creative Studio</strong>
                <p>Your personal GrowthFlow workspace.</p>
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row-icon"><Sparkles size={18} /></span>
              <div>
                <strong>AI provider</strong>
                <p>No provider connected yet. AI requests are not sent anywhere.</p>
              </div>
              <span className="connection-status">Not connected</span>
            </div>
            <div className="settings-row">
              <span className="settings-row-icon"><Clock3 size={18} /></span>
              <div>
                <strong>Current version</strong>
                <p>Creative workspace foundation</p>
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

type Project = {
  title: string;
  category: string;
  updated: string;
  icon: typeof MessageSquareText;
  color: string;
};

function ProjectGrid({ projects }: { projects: Project[] }) {
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
        const ProjectIcon = project.icon;

        return (
          <article className="project-card" key={`${project.title}-${index}`}>
            <div className={`project-preview preview-${project.color}`}>
              <div className="preview-topline">
                <span className="preview-brand">
                  <Layers3 size={13} /> GF / STUDIO
                </span>
                <span className="preview-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="preview-artwork">
                <span className="preview-ring ring-large" />
                <span className="preview-ring ring-small" />
                <span className="preview-symbol">
                  <ProjectIcon size={27} strokeWidth={1.5} />
                </span>
              </div>
              <span className="preview-category">{project.category}</span>
            </div>
            <div className="project-card-content">
              <div>
                <h3>{project.title}</h3>
                <p><Clock3 size={12} /> {project.updated}</p>
              </div>
              <button
                className="project-open"
                aria-label={`Open ${project.title}`}
                onClick={() => window.alert("This project is a local brief preview. Persistent project storage will be added in a later step.")}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default App;
