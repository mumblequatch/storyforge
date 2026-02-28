import React, { useRef, useEffect } from 'react';
import { createChoice, Icons } from '../lib/storyData.jsx';

const SceneCard = ({
  scene,
  scenes,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onStartConnection,
  connectingFrom,
  onCompleteConnection
}) => {
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  // Reset input values when scene.id changes (e.g., New Story)
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.value = scene.title;
    }
    if (contentRef.current) {
      contentRef.current.value = scene.content;
    }
  }, [scene.id]);

  const handleTitleChange = (e) => {
    onUpdate({ ...scene, title: e.target.value });
  };

  const handleContentChange = (e) => {
    onUpdate({ ...scene, content: e.target.value });
  };

  const handleChoiceAdd = () => {
    const newChoice = createChoice(Date.now().toString());
    onUpdate({
      ...scene,
      choices: [...scene.choices, newChoice]
    });
  };

  const handleChoiceUpdate = (choiceId, updates) => {
    onUpdate({
      ...scene,
      choices: scene.choices.map(c => c.id === choiceId ? { ...c, ...updates } : c)
    });
  };

  const handleChoiceDelete = (choiceId) => {
    onUpdate({
      ...scene,
      choices: scene.choices.filter(c => c.id !== choiceId)
    });
  };

  const isValidConnectionTarget = connectingFrom && connectingFrom.sceneId !== scene.id;

  return (
    <div
      className={`scene-card ${isSelected ? 'selected' : ''} ${scene.isStart ? 'is-start' : ''} ${scene.isEnding ? 'is-ending' : ''} ${isValidConnectionTarget ? 'can-connect' : ''}`}
    >
      <div
        className="scene-header"
        onClick={() => isValidConnectionTarget ? onCompleteConnection(scene.id) : onSelect(scene.id)}
      >
        <div className="scene-badges">
          {scene.isStart && <span className="badge start"><Icons.Flag /> Start</span>}
          {scene.isEnding && <span className="badge ending"><Icons.End /> Ending</span>}
        </div>
        <div className="scene-actions">
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onUpdate({ ...scene, isStart: !scene.isStart }); }}
            title="Set as starting scene"
          >
            <Icons.Flag />
          </button>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onUpdate({ ...scene, isEnding: !scene.isEnding }); }}
            title="Mark as ending"
          >
            <Icons.End />
          </button>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onDuplicate(scene.id); }}
            title="Duplicate scene"
          >
            <Icons.Duplicate />
          </button>
          <button
            className="icon-btn danger"
            onClick={(e) => { e.stopPropagation(); onDelete(scene.id); }}
            title="Delete scene"
          >
            <Icons.Trash />
          </button>
        </div>
      </div>

      <input
        ref={titleRef}
        className="scene-title"
        defaultValue={scene.title}
        onChange={handleTitleChange}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        placeholder="Scene title..."
      />

      <textarea
        ref={contentRef}
        className="scene-content"
        defaultValue={scene.content}
        onChange={handleContentChange}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        placeholder="What happens in this scene? Describe the setting, action, dialogue..."
        rows={4}
      />

      {!scene.isEnding && (
        <div className="choices-section">
          <div className="choices-header">
            <span>Choices</span>
            <button className="add-choice-btn" onClick={(e) => { e.stopPropagation(); handleChoiceAdd(); }}>
              <Icons.Plus /> Add Choice
            </button>
          </div>

          <div className="choices-list">
            {scene.choices.map(choice => (
              <div key={choice.id} className="choice-item">
                <input
                  className="choice-text"
                  value={choice.text}
                  onChange={(e) => handleChoiceUpdate(choice.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  placeholder="Choice text..."
                />
                <div className="choice-target">
                  <select
                    value={choice.targetSceneId || ''}
                    onChange={(e) => handleChoiceUpdate(choice.id, { targetSceneId: e.target.value || null })}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                  >
                    <option value="">→ Select destination...</option>
                    {scenes.filter(s => s.id !== scene.id).map(s => (
                      <option key={s.id} value={s.id}>→ {s.title || 'Untitled'}</option>
                    ))}
                  </select>
                  <button
                    className="icon-btn small danger"
                    onClick={(e) => { e.stopPropagation(); handleChoiceDelete(choice.id); }}
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            ))}
            {scene.choices.length === 0 && (
              <div className="no-choices">No choices yet. Add choices to branch the story.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneCard;
