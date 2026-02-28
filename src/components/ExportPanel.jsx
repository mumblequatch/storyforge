import React, { useState } from 'react';
import { generateInkCode, Icons, formatTextToHTML, validateStory } from '../lib/storyData.jsx';

const REPO_OWNER = 'mumblequatch';
const REPO_NAME = 'storyforge';
const BRANCH = 'gh-pages';
const TOKEN_KEY = 'storyforge-gh-token';

const ExportPanel = ({ scenes, storyTitle, onGoToEditor }) => {
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState('ink');
  const [publishState, setPublishState] = useState('idle'); // idle | validating | publishing | published | error
  const [publishUrl, setPublishUrl] = useState('');
  const [publishError, setPublishError] = useState('');
  const [validationIssues, setValidationIssues] = useState(null); // null or array of { type, severity, message }
  const [cachedToken, setCachedToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
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

  const slugify = (text) => {
    return (text || 'story')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const getToken = () => {
    if (cachedToken) return cachedToken;
    let token = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch {}
    if (token) {
      setCachedToken(token.trim());
      return token.trim();
    }
    token = prompt('Enter a GitHub Personal Access Token with "repo" scope.\nThis is stored in your browser only.');
    if (token) {
      const trimmed = token.trim();
      setCachedToken(trimmed);
      try { localStorage.setItem(TOKEN_KEY, trimmed); } catch {}
      return trimmed;
    }
    return null;
  };

  const forgetToken = () => {
    setCachedToken(null);
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  };

  const handlePublishClick = () => {
    const issues = validateStory(scenes);
    if (issues.length > 0) {
      setValidationIssues(issues);
      setPublishState('validating');
      return;
    }
    // No issues — publish directly
    doPublish();
  };

  const doPublish = async () => {
    const token = getToken();
    if (!token) {
      setPublishState('idle');
      return;
    }

    setValidationIssues(null);
    setPublishState('publishing');
    setPublishError('');
    setPublishUrl('');

    const html = generateHTML();
    const slug = slugify(storyTitle);
    const path = `stories/${slug}.html`;
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    try {
      // Check if file already exists (to get SHA for update)
      let sha = undefined;
      try {
        const existing = await fetch(`${apiUrl}?ref=${BRANCH}`, {
          headers: { Authorization: `token ${token}` },
        });
        if (existing.ok) {
          const data = await existing.json();
          sha = data.sha;
        }
      } catch {
        // File doesn't exist yet, that's fine
      }

      // PUT the file
      const body = {
        message: `Publish story: ${storyTitle || 'Untitled'}`,
        content: btoa(unescape(encodeURIComponent(html))),
        branch: BRANCH,
      };
      if (sha) body.sha = sha;

      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `GitHub API error (${res.status})`);
      }

      const liveUrl = `https://${REPO_OWNER}.github.io/${REPO_NAME}/${path}`;
      setPublishUrl(liveUrl);
      setPublishState('published');
    } catch (err) {
      setPublishError(err.message);
      setPublishState('error');
    }
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
    .choice-btn.chosen {
      background: rgba(122, 162, 247, 0.2);
      border-color: #7aa2f7;
      color: #b4d0fb;
      cursor: default;
      font-style: italic;
    }
    .choice-btn.chosen:hover {
      transform: none;
    }
    .choice-btn.unchosen {
      opacity: 0.3;
      cursor: default;
      border-color: rgba(122, 162, 247, 0.15);
    }
    .choice-btn.unchosen:hover {
      transform: none;
      background: rgba(122, 162, 247, 0.1);
      border-color: rgba(122, 162, 247, 0.15);
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

    function fmt(t) { return t ? t.replace(/\\*([^*]+)\\*/g, '<em>$1</em>') : ''; }

    function render() {
      const container = document.getElementById('story');
      let html = '';

      history.forEach(item => {
        html += '<div class="passage">';
        if (item.title) html += '<h2 class="passage-title">' + item.title + '</h2>';
        html += '<p class="passage-text">' + fmt(item.text) + '</p>';
        html += '</div>';

        // Show all choices for this beat, with chosen highlighted and unchosen faded
        if (item.choices && item.choices.length > 0) {
          html += '<div class="choices">';
          item.choices.forEach(function(c) {
            if (c.id === item.chosenId) {
              html += '<div class="choice-btn chosen">▸ ' + c.text + '</div>';
            } else {
              html += '<div class="choice-btn unchosen">' + c.text + '</div>';
            }
          });
          html += '</div>';
        }
      });

      html += '<div class="passage">';
      if (currentScene.title) html += '<h2 class="passage-title">' + currentScene.title + '</h2>';
      html += '<p class="passage-text">' + fmt(currentScene.content) + '</p>';
      html += '</div>';

      var validChoices = currentScene.choices.filter(function(c) { return c.targetSceneId; });
      if (currentScene.isEnding || validChoices.length === 0) {
        html += '<div class="end"><p>— The End —</p>';
        html += '<button class="restart-btn" onclick="restart()">Play Again</button></div>';
      } else {
        html += '<div class="choices">';
        validChoices.forEach(function(choice) {
          html += '<button class="choice-btn" onclick="choose(\\'' + choice.id + '\\')">' + choice.text + '</button>';
        });
        html += '</div>';
      }

      container.innerHTML = html;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    function choose(choiceId) {
      var validChoices = currentScene.choices.filter(function(c) { return c.targetSceneId; });
      var choice = validChoices.find(function(c) { return c.id === choiceId; });
      if (!choice) return;

      history.push({
        title: currentScene.title,
        text: currentScene.content,
        choices: validChoices,
        chosenId: choiceId
      });

      currentScene = scenes.find(function(s) { return s.id === choice.targetSceneId; });
      render();
    }

    function restart() {
      currentScene = scenes.find(function(s) { return s.isStart; }) || scenes[0];
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
              <button
                className="publish-btn"
                onClick={handlePublishClick}
                disabled={publishState === 'publishing'}
              >
                {publishState === 'publishing'
                  ? <><span className="publish-spinner" /> Publishing...</>
                  : <><Icons.Upload /> Publish</>
                }
              </button>
            </div>

            {publishState === 'validating' && validationIssues && (
              <div className="validation-report">
                <div className="validation-header">
                  <strong>Story check found {validationIssues.length} issue{validationIssues.length !== 1 ? 's' : ''}</strong>
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
                <div className="validation-actions">
                  <button className="validation-dismiss" onClick={() => { setValidationIssues(null); setPublishState('idle'); if (onGoToEditor) onGoToEditor(); }}>
                    Go Fix
                  </button>
                  <button className="validation-override" onClick={doPublish}>
                    Publish Anyway
                  </button>
                </div>
              </div>
            )}

            {publishState === 'published' && publishUrl && (
              <div className="publish-url">
                <span className="publish-url-label">Live at:</span>
                <a href={publishUrl} target="_blank" rel="noopener">{publishUrl}</a>
                <button className="publish-copy-btn" onClick={() => handleCopy(publishUrl)}>
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            )}

            {publishState === 'error' && (
              <div className="publish-status publish-error">
                Publish failed: {publishError}
              </div>
            )}

            <div className="publish-meta">
              <button className="forget-token-link" onClick={forgetToken}>
                Forget GitHub token
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
