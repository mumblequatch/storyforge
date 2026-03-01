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
        if (e.shiftKey) redo();
        else undo();
      }
      // Escape closes the editor panel
      if (e.key === 'Escape' && selectedSceneId) {
        setSelectedSceneId(null);
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
    setOverlay(null);
    setShowNewStoryConfirm(false);
  };

  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [overlay, setOverlay] = useState(null); // 'preview' | 'export' | null
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
          setSelectedSceneId(null);
        }
      } catch {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // BFS for depth (used by editor panel badges)
  const sceneDepth = useMemo(() => {
    const startScene = scenes.find(s => s.isStart) || scenes[0];
    if (!startScene) return new Map();
    const depthMap = new Map();
    const queue = [{ id: startScene.id, depth: 0 }];
    depthMap.set(startScene.id, 0);
    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      const scene = scenes.find(s => s.id === id);
      if (!scene) continue;
      for (const choice of scene.choices) {
        if (choice.targetSceneId && !depthMap.has(choice.targetSceneId)) {
          depthMap.set(choice.targetSceneId, depth + 1);
          queue.push({ id: choice.targetSceneId, depth: depth + 1 });
        }
      }
    }
    return depthMap;
  }, [scenes]);

  const stats = {
    scenes: scenes.length,
    choices: scenes.reduce((acc, s) => acc + s.choices.length, 0),
    endings: scenes.filter(s => s.isEnding).length,
    unconnected: scenes.filter(s => !s.isEnding && s.choices.filter(c => c.targetSceneId).length === 0).length
  };

  const selectedScene = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null;

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

        <div className="header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.ink,text/plain"
            className="hidden-input"
            onChange={handleLoad}
          />
          <div className="stats">
            <div className="stat"><strong>{stats.scenes}</strong> scenes</div>
            <div className="stat"><strong>{stats.choices}</strong> choices</div>
            <div className="stat"><strong>{stats.endings}</strong> endings</div>
            {stats.unconnected > 0 && (
              <div className="stat warning"><strong>{stats.unconnected}</strong> dead ends</div>
            )}
          </div>
          <button className="btn btn-secondary" title="Undo (Cmd+Z)" onClick={undo} disabled={undoStack.length === 0}>
            <Icons.Undo />
          </button>
          <button className="btn btn-secondary" title="Redo (Cmd+Shift+Z)" onClick={redo} disabled={redoStack.length === 0}>
            <Icons.Redo />
          </button>
          <button className="btn btn-accent" onClick={() => {
            const hasContent = scenes.length > 1 || (scenes[0]?.content && scenes[0].content.length > 0);
            if (hasContent) setShowNewStoryConfirm(true);
            else handleNewStory();
          }}>
            <Icons.Plus /> New
          </button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Icons.Upload /> Load
          </button>
          <button className="btn btn-secondary" onClick={handleSave}>
            <Icons.Save /> Save
          </button>
          <button
            className={`btn ${overlay === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setOverlay(overlay === 'preview' ? null : 'preview')}
          >
            <Icons.Play /> Test
          </button>
          <button
            className={`btn ${overlay === 'export' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setOverlay(overlay === 'export' ? null : 'export')}
          >
            <Icons.Share /> Export
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Map is always the base layer */}
        <StoryMap
          scenes={scenes}
          selectedSceneId={selectedSceneId}
          onSelectScene={(id) => {
            setSelectedSceneId(id === selectedSceneId ? null : id);
            setOverlay(null);
          }}
          onConnect={(sourceId, targetId) => {
            pushUndo(storyTitle, scenes);
            const source = scenes.find(s => s.id === sourceId);
            if (!source) return;
            const newChoice = createChoice(Date.now().toString(), '', targetId);
            handleUpdateScene({ ...source, choices: [...source.choices, newChoice] });
          }}
          onAddScene={handleAddScene}
        />

        {/* Scene editor panel slides in from the right */}
        <div className={`scene-editor-panel ${selectedScene ? 'open' : ''}`}>
          {selectedScene && (
            <>
              <div className="scene-editor-header">
                <span className="scene-editor-title">Edit Scene</span>
                <button className="icon-btn" onClick={() => setSelectedSceneId(null)} title="Close (Esc)">
                  <Icons.Close />
                </button>
              </div>
              <div className="scene-editor-body">
                <SceneCard
                  key={selectedScene.id}
                  scene={selectedScene}
                  scenes={scenes}
                  depth={sceneDepth.has(selectedScene.id) ? sceneDepth.get(selectedScene.id) : null}
                  branchColors={null}
                  isSelected={true}
                  onSelect={() => {}}
                  onUpdate={handleUpdateScene}
                  onDelete={(id) => { handleDeleteScene(id); setSelectedSceneId(null); }}
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
              </div>
            </>
          )}
        </div>

        {/* Overlay panels for Test and Export */}
        {overlay === 'preview' && (
          <div className="overlay-panel">
            <PreviewPanel scenes={scenes} onGoToEditor={() => setOverlay(null)} />
          </div>
        )}

        {overlay === 'export' && (
          <div className="overlay-panel">
            <ExportPanel scenes={scenes} storyTitle={storyTitle} onGoToEditor={() => setOverlay(null)} />
          </div>
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
