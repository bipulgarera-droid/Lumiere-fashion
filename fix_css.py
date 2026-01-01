
import re

file_path = '/Users/bipul/Downloads/ALL WORKSPACES/Lumiere Fashion/src/App.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# Pattern 1: Fix "word - word" or "word - number"
# e.g., "flex - 1", "brand - 900", "border - t"
# We match letter/digit/bracket, space-dash-space, letter/digit/bracket
# We run this loop multiple times to handle chain "text - brand - 400"
for _ in range(5):
    content = re.sub(r'([a-zA-Z0-9\[]) - ([a-zA-Z0-9\]])', r'\1-\2', content)

# Pattern 2: Fix " - [" specifically if missed (e.g. after a dash we just fixed?)
# "min-w - [70px]" -> "min-w-[70px]"
content = re.sub(r' - \[', '-[', content)

# Pattern 3: Fix "relative border - 2" where 2 is a digit
# handled by Pattern 1

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed CSS corruption in App.tsx")
