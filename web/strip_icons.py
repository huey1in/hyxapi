#!/usr/bin/env python3
"""
Strip all icon imports and usages from settings files.
Removes:
- lucide-react imports
- @douyinfe/semi-icons imports
- icon={...} props from SectionWithSave/Card
- iconColor props
- Icon JSX in button/title spans (keep icon-only buttons)
"""
import re
import sys
from pathlib import Path

def strip_icons(content: str, filepath: str) -> str:
    """Remove all icon imports and usages."""
    original = content

    # 1. Remove lucide-react imports
    content = re.sub(
        r"import\s+\{[^}]*\}\s+from\s+['\"]lucide-react['\"];\s*\n",
        "",
        content,
        flags=re.MULTILINE
    )

    # 2. Remove @douyinfe/semi-icons imports
    content = re.sub(
        r"import\s+\{[^}]*\}\s+from\s+['\"]@douyinfe/semi-icons['\"];\s*\n",
        "",
        content,
        flags=re.MULTILINE
    )

    # 3. Remove icon={...} props (single line)
    content = re.sub(
        r"\s*icon=\{[^}]+\}\s*",
        "",
        content
    )

    # 4. Remove iconColor props
    content = re.sub(
        r"\s*iconColor=['\"][^'\"]*['\"]\s*",
        "",
        content
    )

    # 5. Remove icon JSX in title spans (pattern: <Icon ... />)
    # Match: <SomeIcon size={...} ... />
    content = re.sub(
        r"<[A-Z][a-zA-Z0-9]*\s+[^>]*size=\{[^}]+\}[^>]*/>\s*",
        "",
        content
    )

    # 6. Simplify orphaned wrapper spans
    # <span className='flex items-center gap-2'>{t('...')}</span>
    # becomes: <span>{t('...')}</span>
    content = re.sub(
        r"<span\s+className=['\"]flex\s+items-center\s+gap-[0-9]+['\"]>",
        "<span>",
        content
    )

    # 7. Remove icon const declarations (const Icon = tb.icon;)
    content = re.sub(
        r"\s*const\s+Icon\s*=\s*[^;]+;\s*\n",
        "",
        content,
        flags=re.MULTILINE
    )

    if content != original:
        print(f"✓ {filepath}")
        return content
    else:
        print(f"  {filepath} (no changes)")
        return content

def main():
    base = Path("src")

    # Target files
    patterns = [
        "pages/Setting/**/*.jsx",
        "pages/Setting/**/*.js",
        "components/settings/**/*.jsx",
        "components/settings/**/*.js",
    ]

    files = []
    for pattern in patterns:
        files.extend(base.glob(pattern))

    files = sorted(set(files))

    # Exclude already-cleaned files
    exclude = {
        "src/components/settings/auth/LoginRegister.jsx",
        "src/components/settings/auth/ServerAndSSRF.jsx",
        "src/components/settings/auth/OAuthProviders.jsx",
        "src/components/settings/auth/PasskeyAndMisc.jsx",
        "src/components/settings/PersonalSetting.jsx",
    }

    files = [f for f in files if str(f) not in exclude]

    print(f"Processing {len(files)} files...\n")

    for filepath in files:
        try:
            content = filepath.read_text(encoding="utf-8")
            new_content = strip_icons(content, str(filepath))
            if new_content != content:
                filepath.write_text(new_content, encoding="utf-8")
        except Exception as e:
            print(f"✗ {filepath}: {e}", file=sys.stderr)

    print(f"\nDone. Processed {len(files)} files.")

if __name__ == "__main__":
    main()
