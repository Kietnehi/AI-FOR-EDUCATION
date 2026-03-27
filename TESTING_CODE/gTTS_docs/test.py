from gtts import gTTS
import gtts.lang

languages = gtts.lang.tts_langs()

# Header markdown
markdown_output = "# 🌍 Danh sách ngôn ngữ hỗ trợ trong gTTS\n\n"
markdown_output += f"**Tổng số ngôn ngữ:** `{len(languages)}`\n\n"

# Tạo bảng
markdown_output += "| STT | Code | Ngôn ngữ |\n"
markdown_output += "|-----|------|----------|\n"

for i, (code, name) in enumerate(languages.items(), start=1):
    markdown_output += f"| {i} | `{code}` | {name} |\n"

# Lưu file
with open("gtts_languages.md", "w", encoding="utf-8") as f:
    f.write(markdown_output)

print(markdown_output)