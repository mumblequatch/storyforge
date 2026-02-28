import React, { useState, useEffect, useRef } from 'react';
import { StoryEngine, Icons } from '../lib/storyData.jsx';

const PreviewPanel = ({ scenes }) => {
  const [engine, setEngine] = useState(null);
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const contentRef = useRef(null);

  useEffect(() => {
    const newEngine = new StoryEngine(scenes);
    setEngine(newEngine);
    setState(newEngine.getCurrentState());
    setHistory([]);
  }, [scenes]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [history]);

  const handleChoice = (choiceId, choiceText) => {
    if (!engine) return;
    setHistory(prev => [...prev, { type: 'choice', text: choiceText }]);
    const newState = engine.makeChoice(choiceId);
    setHistory(prev => [...prev, { type: 'content', title: newState.title, text: newState.content }]);
    setState(newState);
  };

  const handleRestart = () => {
    if (!engine) return;
    const newState = engine.restart();
    setState(newState);
    setHistory([]);
  };

  const handleBack = () => {
    if (!engine || engine.history.length === 0) return;
    const newState = engine.goBack();
    setState(newState);
    setHistory(prev => prev.slice(0, -2));
  };

  if (!state) return null;

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h2>Story Preview</h2>
        <div className="preview-controls">
          <button onClick={handleBack} disabled={!engine || engine.history.length === 0}>
            <Icons.Back /> Back
          </button>
          <button onClick={handleRestart}>
            <Icons.Restart /> Restart
          </button>
        </div>
      </div>

      <div className="preview-content" ref={contentRef}>
        {history.length === 0 && (
          <div className="story-passage">
            {state.title && <h3 className="passage-title">{state.title}</h3>}
            <p className="passage-text">{state.content || <em>This scene has no content yet.</em>}</p>
          </div>
        )}

        {history.map((item, i) => (
          <div key={i} className={`story-passage ${item.type}`}>
            {item.type === 'choice' ? (
              <p className="chosen-option">▸ {item.text}</p>
            ) : (
              <>
                {item.title && <h3 className="passage-title">{item.title}</h3>}
                <p className="passage-text">{item.text || <em>This scene has no content yet.</em>}</p>
              </>
            )}
          </div>
        ))}

        {state.isEnd ? (
          <div className="story-end">
            <p>— The End —</p>
            <button onClick={handleRestart}>Play Again</button>
          </div>
        ) : (
          <div className="story-choices">
            {state.choices.map(choice => (
              <button
                key={choice.id}
                className="story-choice"
                onClick={() => handleChoice(choice.id, choice.text)}
              >
                {choice.text}
              </button>
            ))}
            {state.choices.length === 0 && !state.isEnd && (
              <p className="no-choices-warning">This scene has no connected choices. Add choices in the editor.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
