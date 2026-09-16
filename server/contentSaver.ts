import fs from 'fs';
import path from 'path';

export function saveContentToHtml(data: any): { success: boolean; version: string; message: string } {
  const indexPath = path.resolve(process.cwd(), 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('index.html not found');
  }

  let html = fs.readFileSync(indexPath, 'utf-8');
  const newVersion = '2026-09-15-v' + Date.now();

  // 1. Update APP_DATA_VERSION (in head script)
  html = html.replace(
    /(var APP_DATA_VERSION = )['"].*?['"];/,
    `$1'${newVersion}';`
  );

  // 2. Update DEFAULT_AUTHOR_INFO
  if (data.authorInfo) {
    const authorInfoStr = JSON.stringify(data.authorInfo, null, 2);
    html = html.replace(
      /(const DEFAULT_AUTHOR_INFO = )\{[\s\S]*?\};/,
      `$1${authorInfoStr};`
    );

    if (data.authorInfo.name) {
      const safeName = data.authorInfo.name;
      html = html.replace(
        /<title>.*?<\/title>/,
        `<title>${safeName} 미니 홈페이지</title>`
      );
      html = html.replace(
        /<meta property="og:title" content=".*?" \/>/,
        `<meta property="og:title" content="${safeName} 미니 홈페이지" />`
      );
      html = html.replace(
        /<meta name="twitter:title" content=".*?" \/>/,
        `<meta name="twitter:title" content="${safeName} 미니 홈페이지" />`
      );
      html = html.replace(
        /(<h1 id="profile-name"[^>]*>)[\s\S]*?(<\/h1>)/,
        `$1${safeName}$2`
      );
      html = html.replace(/savedName \|\| '[^']*'/, `savedName || '${safeName}'`);
    }

    if (data.authorInfo.role) {
      const safeRole = data.authorInfo.role;
      html = html.replace(
        /(<span id="profile-role"[^>]*>)[\s\S]*?(<\/span>)/,
        `$1\n              ${safeRole}\n            $2`
      );
    }

    if (data.authorInfo.oneLineBio) {
      const safeBio = String(data.authorInfo.oneLineBio).replace(/"/g, '&quot;');
      html = html.replace(
        /<meta name="description" content=".*?" \/>/,
        `<meta name="description" content="${safeBio}" />`
      );
      html = html.replace(
        /<meta property="og:description" content=".*?" \/>/,
        `<meta property="og:description" content="${safeBio}" />`
      );
      html = html.replace(
        /<meta name="twitter:description" content=".*?" \/>/,
        `<meta name="twitter:description" content="${safeBio}" />`
      );
      html = html.replace(
        /(<p id="profile-bio"[^>]*>)[\s\S]*?(<\/p>)/,
        `$1\n            ${data.authorInfo.oneLineBio}\n          $2`
      );
    }

    if (data.authorInfo.aboutTitle) {
      html = html.replace(
        /(<h2 id="about-card-title"[^>]*>)[\s\S]*?(<\/h2>)/,
        `$1${data.authorInfo.aboutTitle}$2`
      );
    }

    if (data.authorInfo.aboutBio) {
      html = html.replace(
        /(<p id="about-card-bio"[^>]*>)[\s\S]*?(<\/p>)/,
        `$1${data.authorInfo.aboutBio}$2`
      );
    }

    if (data.authorInfo.skills && Array.isArray(data.authorInfo.skills)) {
      const skillsHtml = data.authorInfo.skills
        .map((s: string) => `<span class="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-indigo-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">\n                <i class="fa-solid fa-check text-indigo-400 text-[10px]"></i>\n                <span>${s}</span>\n              </span>`)
        .join('\n              ');
      html = html.replace(
        /(<div id="about-card-skills"[^>]*>)[\s\S]*?(<\/div>)/,
        `$1\n              ${skillsHtml}\n            $2`
      );
    }
  }

  // 3. Update DEFAULT_CAREERS
  if (data.careers && Array.isArray(data.careers)) {
    const careersStr = JSON.stringify(data.careers, null, 2);
    html = html.replace(
      /(const DEFAULT_CAREERS = )\[[\s\S]*?\];/,
      `$1${careersStr};`
    );
  }

  // 4. Update DEFAULT_CUSTOM_SECTIONS
  if (data.customSections && Array.isArray(data.customSections)) {
    const customSecStr = JSON.stringify(data.customSections, null, 2);
    html = html.replace(
      /(const DEFAULT_CUSTOM_SECTIONS = )\[[\s\S]*?\];/,
      `$1${customSecStr};`
    );
  }

  // 5. Update DEFAULT_WEBAPPS
  if (data.webapps && Array.isArray(data.webapps)) {
    const webappsStr = JSON.stringify(data.webapps, null, 2);
    html = html.replace(
      /(const DEFAULT_WEBAPPS = )\[[\s\S]*?\];/,
      `$1${webappsStr};`
    );
  }

  // 6. Update DEFAULT_AVATAR
  if (data.profileImage) {
    html = html.replace(
      /(^[ \t]*const DEFAULT_AVATAR = )['"].*?['"];/m,
      `$1'${data.profileImage}';`
    );
  }

  // 7. Update DEFAULT_ADMIN_PWD_HASH
  const pwdHashToSave = data.adminPasswordHash || (data.adminPassword && data.adminPassword.length === 64 ? data.adminPassword : null);
  if (pwdHashToSave) {
    html = html.replace(
      /(^[ \t]*const DEFAULT_ADMIN_PWD_HASH = )['"].*?['"];/m,
      `$1'${pwdHashToSave}';`
    );
  }

  // Write updated index.html
  fs.writeFileSync(indexPath, html, 'utf-8');

  // Also sync to dist/index.html if dist exists
  const distIndexPath = path.resolve(process.cwd(), 'dist/index.html');
  if (fs.existsSync(distIndexPath)) {
    fs.writeFileSync(distIndexPath, html, 'utf-8');
  }

  // Update metadata.json if name or description provided
  const metaPath = path.resolve(process.cwd(), 'metadata.json');
  if (fs.existsSync(metaPath) && data.authorInfo) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (data.authorInfo.name) {
        meta.name = `${data.authorInfo.name} 미니 홈페이지`;
      }
      if (data.authorInfo.oneLineBio) {
        meta.description = data.authorInfo.oneLineBio;
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to update metadata.json', e);
    }
  }

  return {
    success: true,
    version: newVersion,
    message: 'index.html 파일에 성공적으로 영구 저장되었습니다.',
  };
}
