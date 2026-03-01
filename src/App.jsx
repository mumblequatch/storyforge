import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createScene, createChoice, getSampleStory, Icons, parseInkFile } from './lib/storyData.jsx';
import SceneCard from './components/SceneCard';
import PreviewPanel from './components/PreviewPanel';
import ExportPanel from './components/ExportPanel';
import StoryMap from './components/StoryMap';
import './App.css';

const STORAGE_KEY = 'storyforge-project';
const MAX_HISTORY = 50;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.scenes && data.scenes.length > 0) return data;
    }
  } catch {}
  return null;
}

function saveToStorage(title, scenes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, scenes }));
  } catch {}
}

export default function StoryBuilder() {
  const saved = useRef(loadFromStorage());
  const initial = saved.current || getSampleStory();

  const [storyTitle, setStoryTitle] = useState(initial.title);
  const [scenes, setScenes] = useState(initial.scenes);

  // ---- Undo / Redo ----
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const debounceRef = useRef(null);

  const pushUndo = useCallback((title, scns) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setUndoStack(prev => {
        const next = [...prev, JSON.stringify({ title, scenes: scns })];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setRedoStack([]);
    }, 300);
  }, []);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop();

      // push current state to redo
      setRedoStack(r => [...r, JSON.stringify({ title: storyTitle, scenes })]);

      const data = JSON.parse(snapshot);
      setStoryTitle(data.title);
      setScenes(data.scenes);
      return next;
    });
  }, [storyTitle, scenes]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop();

      // push current state to undo
      setUndoStack(u => [...u, JSON.stringify({ title: storyTitle, scenes })]);

      const data = JSON.parse(snapshot);
      setStoryTitle(data.title);
      setScenes(data.scenes);
      return next;
    });
  }, [storyTitle, scenes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ---- localStorage auto-save ----
  useEffect(() => {
    saveToStorage(storyTitle, scenes);
  }, [storyTitle, scenes]);

  const [showNewStoryConfirm, setShowNewStoryConfirm] = useState(false);

  const handleNewStory = () => {
    pushUndo(storyTitle, scenes);
    setStoryTitle('Untitled Story');
    setScenes([{ ...createScene(Date.now().toString(), 'Opening Scene', ''), isStart: true, choices: [] }]);
    setSelectedSceneId(null);
    setView('editor');
    setShowNewStoryConfirm(false);
  };

  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [view, setView] = useState('editor');
  const [connectingFrom, setConnectingFrom] = useState(null);
  const fileInputRef = useRef(null);

  const handleAddScene = () => {
    const name = prompt('Scene name:', '');
    if (name === null) return;
    pushUndo(storyTitle, scenes);
    const newScene = createScene(Date.now().toString(), name || `Scene ${scenes.length + 1}`);
    setScenes([...scenes, newScene]);
    setSelectedSceneId(newScene.id);
  };

  // BUG FIX: handleUpdateScene now preserves all properties from updatedScene
  const handleUpdateScene = (updatedScene) => {
    pushUndo(storyTitle, scenes);
    if (updatedScene.isStart) {
      setScenes(scenes.map(s =>
        s.id === updatedScene.id
          ? { ...updatedScene, isStart: true }
          : { ...s, isStart: false }
      ));
    } else {
      setScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
    }
  };

  const handleDeleteScene = (sceneId) => {
    if (scenes.length <= 1) return;
    pushUndo(storyTitle, scenes);

    const updatedScenes = scenes
      .filter(s => s.id !== sceneId)
      .map(s => ({
        ...s,
        choices: s.choices.map(c => ({
          ...c,
          targetSceneId: c.targetSceneId === sceneId ? null : c.targetSceneId
        }))
      }));

    setScenes(updatedScenes);
    if (selectedSceneId === sceneId) {
      setSelectedSceneId(null);
    }
  };

  const handleCreateAndLink = (sourceScene, choiceId) => {
    const choice = sourceScene.choices.find(c => c.id === choiceId);
    const defaultName = choice?.text || '';
    const name = prompt('New scene name:', defaultName);
    if (name === null) return;
    pushUndo(storyTitle, scenes);
    const newId = Date.now().toString();
    const newScene = createScene(newId, name || `Scene ${scenes.length + 1}`);
    const updatedSource = {
      ...sourceScene,
      choices: sourceScene.choices.map(c =>
        c.id === choiceId ? { ...c, targetSceneId: newId } : c
      ),
    };
    setScenes(scenes.map(s => s.id === sourceScene.id ? updatedSource : s).concat(newScene));
    setSelectedSceneId(newId);
  };

  const handleDuplicateScene = (sceneId) => {
    pushUndo(storyTitle, scenes);
    const original = scenes.find(s => s.id === sceneId);
    if (!original) return;

    const newId = Date.now().toString();
    const duplicate = {
      ...original,
      id: newId,
      title: `${original.title} (copy)`,
      isStart: false,
      choices: original.choices.map(c => ({
        ...c,
        id: `${c.id}_copy_${Date.now()}`,
      })),
    };

    setScenes([...scenes, duplicate]);
    setSelectedSceneId(newId);
  };

  const handleSave = () => {
    const data = JSON.stringify({ title: storyTitle, scenes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${storyTitle || 'story'}-project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target.result;
        let data;

        if (file.name.endsWith('.ink')) {
          data = parseInkFile(raw, file.name);
        } else {
          data = JSON.parse(raw);
        }

        if (data.scenes) {
          pushUndo(storyTitle, scenes);
          setScenes(data.scenes);
          setStoryTitle(data.title || 'Imported Story');
        }
      } catch {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // BFS to compute depth, branch colors, and grouped display order
  const BRANCH_COLORS = ['#7aa2f7', '#f7768e', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff', '#ff9e64', '#c0caf5'];

  const { sceneGroups, sceneDepth, sceneBranches } = useMemo(() => {
    const startScene = scenes.find(s => s.isStart) || scenes[0];
    if (!startScene) return { sceneGroups: [{ label: 'Scenes', scenes }], sceneDepth: new Map(), sceneBranches: new Map() };

    // BFS for depth
    const depthMap = new Map();
    const visited = new Set();
    const queue = [{ id: startScene.id, depth: 0 }];
    depthMap.set(startScene.id, 0);
    visited.add(startScene.id);

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      const scene = scenes.find(s => s.id === id);
      if (!scene) continue;

      for (const choice of scene.choices) {
        if (choice.targetSceneId && !visited.has(choice.targetSceneId)) {
          visited.add(choice.targetSceneId);
          depthMap.set(choice.targetSceneId, depth + 1);
          queue.push({ id: choice.targetSceneId, depth: depth + 1 });
        }
      }
    }

    // Branch color tracking: BFS from each of start scene's choices
    const branchMap = new Map(); // sceneId → Set of branch indices
    branchMap.set(startScene.id, new Set()); // start itself has no branch color

    startScene.choices.forEach((choice, branchIdx) => {
      if (!choice.targetSceneId) return;
      const bfsQueue = [choice.targetSceneId];
      const bfsVisited = new Set([startScene.id, choice.targetSceneId]);

      while (bfsQueue.length > 0) {
        const id = bfsQueue.shift();
        if (!branchMap.has(id)) branchMap.set(id, new Set());
        branchMap.get(id).add(branchIdx);

        const scene = scenes.find(s => s.id === id);
        if (!scene) continue;
        for (const c of scene.choices) {
          if (c.targetSceneId && !bfsVisited.has(c.targetSceneId)) {
            bfsVisited.add(c.targetSceneId);
            bfsQueue.push(c.targetSceneId);
          }
        }
      }
    });

    // Group scenes by depth
    const maxDepth = Math.max(...depthMap.values(), 0);
    const groups = [];
    for (let d = 0; d <= maxDepth; d++) {
      const groupScenes = scenes.filter(s => depthMap.get(s.id) === d);
      if (groupScenes.length > 0) {
        groups.push({
          label: d === 0 ? 'Start' : `Depth ${d}`,
          depth: d,
          scenes: groupScenes,
        });
      }
    }

    // Unreachable scenes
    const unreachable = scenes.filter(s => !visited.has(s.id));
    if (unreachable.length > 0) {
      groups.push({ label: 'Unreachable', depth: -1, scenes: unreachable });
    }

    return { sceneGroups: groups, sceneDepth: depthMap, sceneBranches: branchMap };
  }, [scenes]);

  const stats = {
    scenes: scenes.length,
    choices: scenes.reduce((acc, s) => acc + s.choices.length, 0),
    endings: scenes.filter(s => s.isEnding).length,
    unconnected: scenes.filter(s => !s.isEnding && s.choices.filter(c => c.targetSceneId).length === 0).length
  };

  return (
    <div className="story-builder">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            StoryForge
          </div>
          <input
            className="story-title-input"
            value={storyTitle}
            onChange={(e) => { pushUndo(storyTitle, scenes); setStoryTitle(e.target.value); }}
            placeholder="Story title..."
          />
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-tab ${view === 'editor' ? 'active' : ''}`}
            onClick={() => setView('editor')}
          >
            <Icons.Grid /> Build
          </button>
          <button
            className={`nav-tab ${view === 'map' ? 'active' : ''}`}
            onClick={() => setView('map')}
          >
            <Icons.Map /> Map
          </button>
          <button
            className={`nav-tab ${view === 'preview' ? 'active' : ''}`}
            onClick={() => setView('preview')}
          >
            <Icons.Play /> Test
          </button>
          <button
            className={`nav-tab ${view === 'export' ? 'active' : ''}`}
            onClick={() => setView('export')}
          >
            <Icons.Share /> Export
          </button>
        </div>

        <div className="header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.ink,text/plain"
            className="hidden-input"
            onChange={handleLoad}
          />
          <button className="btn btn-secondary" title="Undo (Cmd+Z)" onClick={undo} disabled={undoStack.length === 0}>
            <Icons.Undo />
          </button>
          <button className="btn btn-secondary" title="Redo (Cmd+Shift+Z)" onClick={redo} disabled={redoStack.length === 0}>
            <Icons.Redo />
          </button>
          <button className="btn btn-accent" onClick={() => {
            const hasContent = scenes.length > 1 || (scenes[0]?.content && scenes[0].content.length > 0);
            if (hasContent) {
              setShowNewStoryConfirm(true);
            } else {
              handleNewStory();
            }
          }}>
            <Icons.Plus /> New
          </button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Icons.Upload /> Load
          </button>
          <button className="btn btn-secondary" onClick={handleSave}>
            <Icons.Save /> Save
          </button>
        </div>
      </header>

      <main className="main-content">
        {view === 'editor' && (
          <div className="editor-panel">
            <div className="editor-header">
              <h2>Story Scenes</h2>
              <div className="stats">
                <div className="stat"><strong>{stats.scenes}</strong> scenes</div>
                <div className="stat"><strong>{stats.choices}</strong> choices</div>
                <div className="stat"><strong>{stats.endings}</strong> endings</div>
                {stats.unconnected > 0 && (
                  <div className="stat warning"><strong>{stats.unconnected}</strong> dead ends</div>
                )}
              </div>
            </div>

            {sceneGroups.map((group, gi) => (
              <div key={gi}>
                <div className={`depth-separator ${group.depth === -1 ? 'unreachable' : ''}`}>
                  <span className="depth-label">{group.label}</span>
                  <span className="depth-line" />
                </div>
                <div className="scene-grid">
                  {group.scenes.map(scene => {
                    const branches = sceneBranches.get(scene.id);
                    const branchColors = branches && branches.size > 0
                      ? [...branches].map(i => BRANCH_COLORS[i % BRANCH_COLORS.length])
                      : null;

                    return (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        scenes={scenes}
                        depth={sceneDepth.has(scene.id) ? sceneDepth.get(scene.id) : null}
                        branchColors={branchColors}
                        isSelected={selectedSceneId === scene.id}
                        onSelect={setSelectedSceneId}
                        onUpdate={handleUpdateScene}
                        onDelete={handleDeleteScene}
                        onDuplicate={handleDuplicateScene}
                        onCreateAndLink={handleCreateAndLink}
                        onStartConnection={setConnectingFrom}
                        connectingFrom={connectingFrom}
                        onCompleteConnection={(targetId) => {
                          if (connectingFrom) {
                            const sourceScene = scenes.find(s => s.id === connectingFrom.sceneId);
                            const updatedChoices = sourceScene.choices.map(c =>
                              c.id === connectingFrom.choiceId
                                ? { ...c, targetSceneId: targetId }
                                : c
                            );
                            handleUpdateScene({ ...sourceScene, choices: updatedChoices });
                            setConnectingFrom(null);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="add-scene-card" onClick={handleAddScene}>
              <Icons.Plus />
              <span>Add New Scene</span>
            </div>
          </div>
        )}

        {view === 'map' && (
          <StoryMap
            scenes={scenes}
            onSelectScene={(id) => {
              setSelectedSceneId(id);
              setView('editor');
            }}
            onConnect={(sourceId, targetId) => {
              pushUndo(storyTitle, scenes);
              const source = scenes.find(s => s.id === sourceId);
              if (!source) return;
              const newChoice = createChoice(Date.now().toString(), '', targetId);
              handleUpdateScene({ ...source, choices: [...source.choices, newChoice] });
            }}
          />
        )}

        {view === 'preview' && (
          <PreviewPanel scenes={scenes} onGoToEditor={() => setView('editor')} />
        )}

        {view === 'export' && (
          <ExportPanel scenes={scenes} storyTitle={storyTitle} onGoToEditor={() => setView('editor')} />
        )}
      </main>

      {showNewStoryConfirm && (
        <div className="modal-overlay" onClick={() => setShowNewStoryConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start New Story?</h3>
            <p>Your current work will be lost unless you save it first.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewStoryConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleNewStory}>
                Start New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
