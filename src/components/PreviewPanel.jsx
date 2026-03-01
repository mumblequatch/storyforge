import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StoryEngine, Icons, renderFormattedText, validateStory } from '../lib/storyData.jsx';

// Each "beat" = { scene title/content, choices[], chosenId | null }
// History is an array of beats. The last beat has chosenId=null (active).

const PreviewPanel = ({ scenes, onGoToEditor }) => {
  const [engine, setEngine] = useState(null);
  const [beats, setBeats] = useState([]);
  const contentRef = useRef(null);
  const activeBeatRef = useRef(null);

  const buildBeat = (eng) => {
    const st = eng.getCurrentState();
    return {
      title: st.title,
      content: st.content,
      choices: st.choices, // all choices with targetSceneId
      isEnd: st.isEnd,
      chosenId: null,
    };
  };

  useEffect(() => {
    const eng = new StoryEngine(scenes);
    setEngine(eng);
    setBeats([buildBeat(eng)]);
  }, [scenes]);

  useEffect(() => {
    const container = contentRef.current;
    const activeBeat = activeBeatRef.current;
    if (container && activeBeat) {
      const containerHeight = container.clientHeight;
      const beatTop = activeBeat.offsetTop;
      container.scrollTo({ top: beatTop - containerHeight / 2 + 40, behavior: 'smooth' });
    }
  }, [beats]);

  const handleChoice = (choiceId) => {
    if (!engine) return;
    // Mark current beat's chosen
    setBeats(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], chosenId: choiceId };
      return updated;
    });
    // Advance engine
    engine.makeChoice(choiceId);
    const newBeat = buildBeat(engine);
    setBeats(prev => [...prev, newBeat]);
  };

  const handleRestart = () => {
    if (!engine) return;
    engine.restart();
    setBeats([buildBeat(engine)]);
  };

  const handleBack = () => {
    if (!engine || beats.length <= 1) return;
    engine.goBack();
    // Remove last beat and un-choose the previous one
    setBeats(prev => {
      const updated = prev.slice(0, -1);
      updated[updated.length - 1] = { ...updated[updated.length - 1], chosenId: null };
      return updated;
    });
  };

  const validationIssues = useMemo(() => validateStory(scenes), [scenes]);

  if (beats.length === 0) return null;

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h2>Story Preview</h2>
        <div className="preview-controls">
          <button onClick={handleBack} disabled={beats.length <= 1}>
            <Icons.Back /> Back
          </button>
          <button onClick={handleRestart}>
            <Icons.Restart /> Restart
          </button>
        </div>
      </div>

      {validationIssues.length > 0 && (
        <div className="validation-banner">
          <div className="validation-header">
            <strong>{validationIssues.length} issue{validationIssues.length !== 1 ? 's' : ''} found</strong>
          </div>
          <ul className="validation-list">
            {validationIssues.map((issue, i) => (
              <li key={i} className={`validation-item validation-${issue.severity}`}>
                <span className="validation-icon">
                  {issue.severity === 'error' ? '!!' : '!'}
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
          {onGoToEditor && (
            <button className="validation-dismiss" onClick={onGoToEditor}>
              Go Fix
            </button>
          )}
        </div>
      )}

      <div className="preview-content" ref={contentRef}>
        {beats.map((beat, i) => {
          const isActive = i === beats.length - 1;

          return (
            <div key={i} className="story-beat" ref={isActive ? activeBeatRef : undefined}>
              {/* Scene passage */}
              <div className="story-passage">
                {beat.title && <h3 className="passage-title">{beat.title}</h3>}
                <p className="passage-text">
                  {beat.content ? renderFormattedText(beat.content) : <em>This scene has no content yet.</em>}
                </p>
              </div>

              {/* Ending */}
              {beat.isEnd ? (
                <div className="story-end">
                  <p>— The End —</p>
                  <button onClick={handleRestart}>Play Again</button>
                </div>
              ) : (
                /* Choices */
                <div className="story-choices">
                  {beat.choices.map(choice => {
                    const isChosen = beat.chosenId === choice.id;
                    const isUnchosen = beat.chosenId && !isChosen;
                    const isClickable = isActive && !beat.chosenId;

                    return (
                      <button
                        key={choice.id}
                        className={`story-choice ${isChosen ? 'chosen' : ''} ${isUnchosen ? 'unchosen' : ''}`}
                        onClick={isClickable ? () => handleChoice(choice.id) : undefined}
                        disabled={!isClickable}
                      >
                        {isChosen && '▸ '}{choice.text}
                      </button>
                    );
                  })}
                  {beat.choices.length === 0 && !beat.isEnd && isActive && (
                    <p className="no-choices-warning">This scene has no connected choices. Add choices in the editor.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PreviewPanel;
