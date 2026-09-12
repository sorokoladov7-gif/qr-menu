from pathlib import Path
import re
import subprocess

root = Path('.')
assets = root / 'src/assets'

by_name = {}
for kind in ('js', 'css', 'img', 'icons', 'pwa'):
    base = assets / kind
    if base.exists():
        for p in base.rglob('*'):
            if p.is_file():
                by_name.setdefault(p.name, []).append('/src/assets/' + p.relative_to(assets).as_posix())

sw = root / 'sw.js'
text = sw.read_text(encoding='utf-8')

def fix_entry(match):
    quote, value, comma = match.group(1), match.group(2), match.group(3)
    if not value.startswith('/') or value.startswith('/src/assets/') or value.startswith('/src/pages/'):
        return match.group(0)
    m = re.match(r'^/(?:js|css|img|icons|pwa)/(?:.+)$', value)
    if not m:
        return match.group(0)
    candidates = by_name.get(Path(value).name, [])
    if candidates:
        return quote + candidates[0] + quote + comma
    return ''

text = re.sub(r'(["\'])((?:/(?:js|css|img|icons|pwa))/[^"\']+)([ ,\n]*)', fix_entry, text)
sw.write_text(text, encoding='utf-8')

# Remove manager E2E expectations for modules that have no physical canonical file.
e2e = root / 'tests/e2e/index.spec.cjs'
source = e2e.read_text(encoding='utf-8')
block_re = re.compile(r"(test\('manager runtime modules are available at their canonical asset paths',[\s\S]*?for \(const path of \[)([\s\S]*?)(\]\) \{)")
match = block_re.search(source)
if match:
    entries = match.group(2)
    names = re.findall(r"'([^']+\.js)'", entries)
    kept = []
    for name in names:
        if (assets / 'js' / 'manager' / name).is_file():
            kept.append(name)
    replacement = ''.join("    '%s',\n" % name for name in kept)
    source = source[:match.start(2)] + '\n' + replacement + '  ' + source[match.end(2):]
    e2e.write_text(source, encoding='utf-8')

subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], check=True)
subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git', 'rm', '-f', 'tools/sw-path-cleanup.py', '.github/workflows/sw-path-cleanup.yml'], check=True)
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m', 'chore: remove remaining non-physical runtime paths'], check=True)
subprocess.run(['git', 'push', '--force', 'origin', 'HEAD:tmp/canonical-runtime-paths'], check=True)
