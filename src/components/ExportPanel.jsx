import React, { useState } from 'react';
import { generateInkCode, Icons } from '../lib/storyData.jsx';

const ExportPanel = ({ scenes, storyTitle }) => {
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState('ink');
  const inkCode = generateInkCode(scenes);

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateHTML = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${storyTitle || 'Interactive Story'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e8e8e8;
      line-height: 1.8;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 60px 24px;
    }
    h1 {
      font-size: 2.5rem;
      text-align: center;
      margin-bottom: 48px;
      font-weight: 400;
      letter-spacing: 0.05em;
      color: #f0c674;
    }
    .passage {
      margin-bottom: 24px;
      animation: fadeIn 0.5s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .passage-title {
      font-size: 1.4rem;
      color: #f0c674;
      margin-bottom: 12px;
      font-weight: 400;
    }
    .passage-text {
      font-size: 1.15rem;
      color: #d4d4d4;
    }
    .choice-made {
      color: #7aa2f7;
      font-style: italic;
      padding: 8px 0;
      border-left: 2px solid #7aa2f7;
      padding-left: 16px;
      margin: 16px 0;
    }
    .choices {
      margin-top: 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .choice-btn {
      background: rgba(122, 162, 247, 0.1);
      border: 1px solid rgba(122, 162, 247, 0.3);
      color: #7aa2f7;
      padding: 16px 24px;
      font-size: 1.05rem;
      font-family: inherit;
      cursor: pointer;
      border-radius: 8px;
      text-align: left;
      transition: all 0.2s ease;
    }
    .choice-btn:hover {
      background: rgba(122, 162, 247, 0.2);
      border-color: #7aa2f7;
      transform: translateX(4px);
    }
    .end {
      text-align: center;
      padding: 48px 0;
      color: #f0c674;
      font-size: 1.3rem;
    }
    .restart-btn {
      background: #f0c674;
      color: #1a1a2e;
      border: none;
      padding: 12px 32px;
      font-size: 1rem;
      font-family: inherit;
      cursor: pointer;
      border-radius: 24px;
      margin-top: 24px;
      transition: transform 0.2s ease;
    }
    .restart-btn:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${storyTitle || 'Interactive Story'}</h1>
    <div id="story"></div>
  </div>
  <script>
    const scenes = ${JSON.stringify(scenes)};
    let currentScene = scenes.find(s => s.isStart) || scenes[0];
    let history = [];

    function render() {
      const container = document.getElementById('story');
      let html = '';

      history.forEach(item => {
        if (item.type === 'content') {
          html += '<div class="passage">';
          if (item.title) html += '<h2 class="passage-title">' + item.title + '</h2>';
          html += '<p class="passage-text">' + (item.text || '') + '</p>';
          html += '</div>';
        } else {
          html += '<p class="choice-made">▸ ' + item.text + '</p>';
        }
      });

      html += '<div class="passage">';
      if (currentScene.title) html += '<h2 class="passage-title">' + currentScene.title + '</h2>';
      html += '<p class="passage-text">' + (currentScene.content || '') + '</p>';
      html += '</div>';

      if (currentScene.isEnding || currentScene.choices.filter(c => c.targetSceneId).length === 0) {
        html += '<div class="end"><p>— The End —</p>';
        html += '<button class="restart-btn" onclick="restart()">Play Again</button></div>';
      } else {
        html += '<div class="choices">';
        currentScene.choices.filter(c => c.targetSceneId).forEach(choice => {
          html += '<button class="choice-btn" onclick="choose(\\'' + choice.id + '\\', \\'' + choice.text.replace(/'/g, "\\\\'") + '\\')">' + choice.text + '</button>';
        });
        html += '</div>';
      }

      container.innerHTML = html;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    function choose(choiceId, choiceText) {
      const choice = currentScene.choices.find(c => c.id === choiceId);
      if (!choice) return;

      history.push({ type: 'content', title: currentScene.title, text: currentScene.content });
      history.push({ type: 'choice', text: choiceText });

      currentScene = scenes.find(s => s.id === choice.targetSceneId);
      render();
    }

    function restart() {
      currentScene = scenes.find(s => s.isStart) || scenes[0];
      history = [];
      render();
    }

    render();
  </script>
</body>
</html>`;
  };

  const generateJSON = () => {
    return JSON.stringify({
      title: storyTitle,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      scenes: scenes
    }, null, 2);
  };

  return (
    <div className="export-panel">
      <div className="export-header">
        <h2>Export Your Story</h2>
      </div>

      <div className="export-tabs">
        <button
          className={exportFormat === 'ink' ? 'active' : ''}
          onClick={() => setExportFormat('ink')}
        >
          Ink Code
        </button>
        <button
          className={exportFormat === 'html' ? 'active' : ''}
          onClick={() => setExportFormat('html')}
        >
          Playable HTML
        </button>
        <button
          className={exportFormat === 'json' ? 'active' : ''}
          onClick={() => setExportFormat('json')}
        >
          JSON Data
        </button>
      </div>

      <div className="export-content">
        {exportFormat === 'ink' && (
          <>
            <p className="export-desc">
              Standard Ink format. Use with <a href="https://www.inklestudios.com/ink/" target="_blank" rel="noopener">Inky editor</a> or integrate into Unity/web games.
            </p>
            <pre className="code-preview">{inkCode}</pre>
            <div className="export-actions">
              <button onClick={() => handleCopy(inkCode)}>
                {copied ? <><Icons.Check /> Copied!</> : <><Icons.Copy /> Copy Code</>}
              </button>
              <button onClick={() => handleDownload(inkCode, `${storyTitle || 'story'}.ink`, 'text/plain')}>
                <Icons.Download /> Download .ink
              </button>
            </div>
          </>
        )}

        {exportFormat === 'html' && (
          <>
            <p className="export-desc">
              Self-contained HTML file that plays your story in any browser. Share it anywhere!
            </p>
            <pre className="code-preview">{generateHTML().slice(0, 1500)}...</pre>
            <div className="export-actions">
              <button onClick={() => handleCopy(generateHTML())}>
                {copied ? <><Icons.Check /> Copied!</> : <><Icons.Copy /> Copy HTML</>}
              </button>
              <button onClick={() => handleDownload(generateHTML(), `${storyTitle || 'story'}.html`, 'text/html')}>
                <Icons.Download /> Download .html
              </button>
            </div>
          </>
        )}

        {exportFormat === 'json' && (
          <>
            <p className="export-desc">
              Raw story data for importing into other tools or backing up your work.
            </p>
            <pre className="code-preview">{generateJSON()}</pre>
            <div className="export-actions">
              <button onClick={() => handleCopy(generateJSON())}>
                {copied ? <><Icons.Check /> Copied!</> : <><Icons.Copy /> Copy JSON</>}
              </button>
              <button onClick={() => handleDownload(generateJSON(), `${storyTitle || 'story'}.json`, 'application/json')}>
                <Icons.Download /> Download .json
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ExportPanel;
