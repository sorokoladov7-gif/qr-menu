from pathlib import Path
import re
import subprocess

root = Path('.')
pages = root / 'src/pages'
assets = root / 'src/assets'

files = []
for base in (root / 'src', root / 'sw.js'):
    if base.is_file():
        files.append(base)
    elif base.exists():
        files.extend(p for p in base.rglob('*') if p.is_file())
for p in root.iterdir():
    if p.is_file() and p.suffix.lower() in {'.html', '.js', '.css', '.json', '.webmanifest'} and p not in files:
        files.append(p)
files = [p for p in files if p.suffix.lower() in {'.html', '.js', '.css', '.json', '.webmanifest'} or p.name == 'sw.js']

asset_names = {k: {} for k in ('js', 'css', 'img', 'icons', 'pwa')}
for kind in asset_names:
    directory = assets / kind
    if directory.exists():
        for p in directory.rglob('*'):
            if p.is_file():
                asset_names[kind].setdefault(p.name, []).append('/src/assets/' + p.relative_to(assets).as_posix())

page_names = {}
for p in pages.rglob('*.html'):
    page_names.setdefault(p.name, []).append('/' + p.relative_to(root).as_posix())

def role_of(path):
    parts = path.parts
    return parts[parts.index('pages') + 1] if 'pages' in parts else None

def canonical_asset(token, role):
    q = token.split('?', 1)
    base = q[0]
    tail = token[len(base):]
    logical = base.lstrip('./').lstrip('/')
    kind, sep, rest = logical.partition('/')
    if kind not in asset_names or not sep:
        return token
    exact = assets / kind / rest
    if exact.is_file():
        return '/src/assets/' + kind + '/' + rest + tail
    candidates = asset_names[kind].get(Path(rest).name, [])
    if kind == 'js' and role:
        for sub in (role, 'shared', 'pwa', 'demo'):
            preferred = [value for value in candidates if f'/js/{sub}/' in value]
            if preferred:
                return preferred[0] + tail
    return (candidates[0] + tail) if candidates else token

def canonical_page(token, role):
    q = token.split('?', 1)
    base = q[0]
    tail = token[len(base):]
    if base.startswith('/src/pages/') or base.startswith('src/pages/'):
        return token
    name = Path(base).name
    if not name.endswith('.html'):
        return token
    candidates = page_names.get(name, [])
    if not candidates:
        return token
    if role:
        preferred = [value for value in candidates if f'/pages/{role}/' in value]
        if preferred:
            return preferred[0] + tail
    preferred_role = {
        'menu.html': 'guest', 'index.html': 'guest',
        'login.html': 'auth', 'register.html': 'auth',
        'forgot-password.html': 'auth', 'reset-password.html': 'auth',
        'admin.html': 'admin', 'manager.html': 'manager',
        'cook.html': 'staff', 'courier.html': 'staff', 'waiter.html': 'staff',
    }.get(name)
    if preferred_role:
        preferred = [value for value in candidates if f'/pages/{preferred_role}/' in value]
        if preferred:
            return preferred[0] + tail
    return candidates[0] + tail

def normalize(token, role):
    if not token or token.startswith(('http:', 'https:', 'data:', 'blob:', 'mailto:', 'tel:', 'javascript:', '#', '/src/pages/', '/src/assets/')):
        return token
    if re.fullmatch(r'/?(?:js|css|img|icons|pwa)/[^\s"\'`<>]+', token):
        return canonical_asset(token, role)
    if re.fullmatch(r'/?manifest(?:-[\w-]+)?\.webmanifest(?:\?[^\s"\'`<>]+)?', token):
        q = token.split('?', 1)
        base = q[0].lstrip('/')
        tail = token[len(q[0]):]
        return '/src/assets/pwa/' + base + tail if (assets / 'pwa' / base).is_file() else token
    if token in ('/favicon.svg', 'favicon.svg') and (assets / 'icons' / 'favicon.svg').is_file():
        return '/src/assets/icons/favicon.svg'
    if token in ('/apple-touch-icon.png', 'apple-touch-icon.png') and (assets / 'icons' / 'apple-touch-icon.png').is_file():
        return '/src/assets/icons/apple-touch-icon.png'
    if re.fullmatch(r'/?[A-Za-z0-9_-]+\.html(?:\?[^\s"\'`<>]+)?', token):
        return canonical_page(token, role)
    return token

quoted = re.compile(r'(["\'`])((?:/?(?:js|css|img|icons|pwa)/[^\s"\'`<>]+)|(?:/?manifest(?:-[\w-]+)?\.webmanifest(?:\?[^\s"\'`<>]+)?)|(?:/?[A-Za-z0-9_-]+\.html(?:\?[^\s"\'`<>]+)?)|(?:/?(?:favicon\.svg|apple-touch-icon\.png)))(["\'`])')
css_url = re.compile(r'url\(\s*(["\']?)([^"\')\s]+)\1\s*\)', re.I)

changed = []
for path in files:
    try:
        source = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        continue
    role = role_of(path)
    updated = quoted.sub(lambda m: m.group(1) + normalize(m.group(2), role) + m.group(3), source)
    if path.suffix.lower() == '.css':
        updated = css_url.sub(lambda m: 'url(' + m.group(1) + normalize(m.group(2), role) + m.group(1) + ')', updated)
    if updated != source:
        path.write_text(updated, encoding='utf-8')
        changed.append(str(path))

print('Changed files:', len(changed))
for path in changed:
    print(path)

legacy = re.compile(r'(?<![A-Za-z0-9_.-])/(?:js|css|img|icons|pwa)/|(?<![A-Za-z0-9_.-])/(?:index|menu|waiter|cook|courier|hall|staff-history|staff-table|manager|manager-demo|manager-staff-statistics|integrations|admin|login|register|forgot-password|reset-password|staff-guide)\.html(?:[?#"\'\s),;]|$)|(?<![A-Za-z0-9_.-])/(?:manifest(?:-[A-Za-z0-9_-]+)?\.webmanifest|favicon\.svg|apple-touch-icon\.png)(?:[?#"\'\s),;]|$)')
violations = []
for path in files:
    try:
        source = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        continue
    if legacy.search(source):
        violations.append(str(path))
if violations:
    raise SystemExit('Legacy runtime paths remain:\n' + '\n'.join(violations))

subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], check=True)
subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git', 'rm', '-f', 'tools/normalize-runtime-paths.py', '.github/workflows/normalize-runtime-paths.yml'], check=True)
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m', 'chore: canonicalize all runtime file paths'], check=True)
subprocess.run(['git', 'push', 'origin', 'HEAD:main'], check=True)
